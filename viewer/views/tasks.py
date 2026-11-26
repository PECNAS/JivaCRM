import json

from datetime import date

from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views import View

from ..models import Employee, Task, TaskComment
from .helpers import role_label


MODE_ALL = 'all'
MODE_OPEN = 'open'
MODE_DONE = 'done'
MODE_REJECTED = 'rejected'
MODE_MINE = 'mine'

STATUSES = [key for key, _ in Task.STATUSES]
PRIORITIES = [key for key, _ in Task.PRIORITIES]


def current_employee(request):
    if not request.user.is_authenticated:
        return None

    try:
        return request.user.employee_profile
    except Employee.DoesNotExist:
        return None


def can_manage(employee):
    return employee is not None and employee.can_manage_tasks()


def parse_date(value):
    text = str(value or '').strip()

    if not text:
        return None

    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def date_display(value):
    return value.strftime('%d.%m.%Y') if value else ''


def initials(employee):
    name = (employee.display_name if employee else '') or ''

    for char in name:
        if char.isalnum():
            return char.upper()

    return '?'


def days_left(deadline):
    if deadline is None:
        return None

    return (deadline - timezone.localdate()).days


def deadline_state(task):
    if task.deadline is None:
        return ''

    if task.status in (Task.STATUS_DONE, Task.STATUS_REJECTED):
        return ''

    days = days_left(task.deadline)

    if days is None:
        return ''

    if days < 0:
        return 'over'

    if days == 0:
        return 'today'

    if days <= 2:
        return 'soon'

    return ''


def deadline_text(task):
    if task.deadline is None:
        return 'без срока'

    days = days_left(task.deadline)
    base = 'до ' + date_display(task.deadline)

    if task.status in (Task.STATUS_DONE, Task.STATUS_REJECTED):
        return base

    if days < 0:
        return base + ' · просрочено'

    if days == 0:
        return base + ' · сегодня'

    if days == 1:
        return base + ' · 1 день'

    return base + ' · ' + str(days) + ' дн.'


def serialize_employee(employee, counts=None):
    return {
        'id': employee.id,
        'name': employee.display_name,
        'full_name': employee.full_name or employee.display_name,
        'login': employee.user.username if employee.user_id else '',
        'role': role_label(employee.primary_role()),
        'initial': initials(employee),
        'open': int((counts or {}).get(employee.id, 0)),
    }


def comment_payload(comment):
    return {
        'id': comment.id,
        'text': comment.text,
        'author': comment.author.display_name if comment.author else 'Система',
        'author_id': comment.author_id,
        'initial': initials(comment.author),
        'date': timezone.localtime(comment.created_at).strftime('%d.%m.%Y %H:%M'),
    }


def task_payload(task, viewer, manage=False, counts=None):
    assignees = list(task.assignees.all())
    assignee_ids = [item.id for item in assignees]
    comments = list(task.comments.select_related('author').all())

    payload = {
        'id': task.id,
        'title': task.title,
        'description': task.description or '',
        'status': task.status,
        'status_display': task.get_status_display(),
        'priority': task.priority,
        'priority_display': task.get_priority_display(),
        'deadline': task.deadline.strftime('%Y-%m-%d') if task.deadline else '',
        'deadline_display': date_display(task.deadline),
        'deadline_text': deadline_text(task),
        'deadline_state': deadline_state(task),
        'author': task.author.display_name if task.author else '',
        'author_id': task.author_id,
        'created_display': timezone.localtime(task.created_at).strftime('%d.%m.%Y'),
        'assignees': [serialize_employee(item, counts) for item in assignees],
        'assignee_ids': assignee_ids,
        'comments': [comment_payload(item) for item in comments],
        'is_mine': viewer is not None and viewer.id in assignee_ids,
    }

    if manage:
        payload['can_manage'] = True

    return payload


def open_counts():
    counts = {}

    for assignee_id in Task.assignees.through.objects.filter(
        task__status__in=[Task.STATUS_OPEN, Task.STATUS_IN_WORK],
    ).values_list('employee_id', flat=True):
        counts[assignee_id] = counts.get(assignee_id, 0) + 1

    return counts


def task_queryset():
    return (
        Task.objects
        .select_related('author')
        .prefetch_related('assignees', 'comments', 'comments__author')
    )


def visible_tasks(employee, manage):
    query = task_queryset()

    if not manage:
        query = query.filter(assignees=employee).distinct()

    return query


def apply_mode(query, mode, employee):
    if mode == MODE_OPEN:
        return query.filter(status__in=[Task.STATUS_OPEN, Task.STATUS_IN_WORK])

    if mode == MODE_DONE:
        return query.filter(status=Task.STATUS_DONE)

    if mode == MODE_REJECTED:
        return query.filter(status=Task.STATUS_REJECTED)

    if mode == MODE_MINE and employee is not None:
        return query.filter(assignees=employee)

    return query


def sort_tasks(items):
    order = {
        Task.STATUS_IN_WORK: 0,
        Task.STATUS_OPEN: 1,
        Task.STATUS_DONE: 2,
        Task.STATUS_REJECTED: 3,
    }

    def key(task):
        deadline = task.deadline or date.max
        return (order.get(task.status, 9), deadline, -task.id)

    return sorted(items, key=key)


def my_open_count(employee):
    if employee is None:
        return 0

    return Task.objects.filter(
        assignees=employee,
        status__in=[Task.STATUS_OPEN, Task.STATUS_IN_WORK],
    ).distinct().count()


def can_view(employee, task, manage):
    if employee is None:
        return False

    if manage:
        return True

    return task.assignees.filter(id=employee.id).exists()


class TasksView(View):
    def get(self, request):
        employee = current_employee(request)

        if employee is None:
            return redirect('login')

        manage = can_manage(employee)

        return render(request, 'tasks.html', {
            'employee': employee,
            'manage': manage,
            'open_count': my_open_count(employee),
        })


class TaskListView(View):
    def get(self, request):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        manage = can_manage(employee)

        mode = (request.GET.get('mode') or MODE_ALL).strip()
        search = (request.GET.get('search') or '').strip()

        query = apply_mode(visible_tasks(employee, manage), mode, employee)

        if search:
            query = query.filter(title__icontains=search)

        counts = open_counts()

        items = [task_payload(task, employee, manage, counts) for task in sort_tasks(list(query))]

        employees = []

        if manage:
            employees = [
                serialize_employee(item, counts)
                for item in Employee.objects.filter(is_active=True).order_by('full_name')
            ]

        return JsonResponse({
            'success': True,
            'manage': manage,
            'mode': mode,
            'search': search,
            'tasks': items,
            'employees': employees,
            'me': serialize_employee(employee, counts),
            'today': timezone.localdate().strftime('%Y-%m-%d'),
        })


class TaskDetailView(View):
    def get(self, request, task_id):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        manage = can_manage(employee)
        task = task_queryset().filter(id=task_id).first()

        if task is None:
            return JsonResponse({'error': 'Задача не найдена'}, status=404)

        if not can_view(employee, task, manage):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        return JsonResponse({'success': True, 'task': task_payload(task, employee, manage, open_counts())})


class TaskSaveView(View):
    def post(self, request, task_id=None):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        if not can_manage(employee):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        title = (request.POST.get('title') or '').strip()

        if not title:
            return JsonResponse({'error': 'Введите название задачи'}, status=400)

        description = (request.POST.get('description') or '').strip()
        deadline = parse_date(request.POST.get('deadline'))

        priority = (request.POST.get('priority') or Task.PRIORITY_NORMAL).strip()

        if priority not in PRIORITIES:
            priority = Task.PRIORITY_NORMAL

        status = (request.POST.get('status') or Task.STATUS_OPEN).strip()

        if status not in STATUSES:
            status = Task.STATUS_OPEN

        raw_ids = request.POST.get('assignees') or '[]'

        try:
            assignee_ids = json.loads(raw_ids)
        except (json.JSONDecodeError, TypeError):
            assignee_ids = []

        if not isinstance(assignee_ids, list):
            assignee_ids = []

        clean_ids = []

        for value in assignee_ids:
            try:
                value = int(value)
            except (TypeError, ValueError):
                continue

            if value not in clean_ids:
                clean_ids.append(value)

        assignees = list(Employee.objects.filter(id__in=clean_ids))

        if task_id:
            task = Task.objects.filter(id=task_id).first()

            if task is None:
                return JsonResponse({'error': 'Задача не найдена'}, status=404)
        else:
            task = Task(author=employee)

        task.title = title[:200]
        task.description = description
        task.deadline = deadline
        task.priority = priority
        task.status = status
        task.save()

        task.assignees.set(assignees)

        fresh = task_queryset().filter(id=task.id).first()

        return JsonResponse({
            'success': True,
            'task': task_payload(fresh, employee, True, open_counts()),
        })


class TaskStatusView(View):
    def post(self, request, task_id):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        manage = can_manage(employee)
        task = task_queryset().filter(id=task_id).first()

        if task is None:
            return JsonResponse({'error': 'Задача не найдена'}, status=404)

        if not can_view(employee, task, manage):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        status = (request.POST.get('status') or '').strip()

        if status not in STATUSES:
            return JsonResponse({'error': 'Неизвестный статус'}, status=400)

        if not manage:
            if task.assignees.filter(id=employee.id).exists() is False:
                return JsonResponse({'error': 'Недостаточно прав'}, status=403)

            if status == Task.STATUS_OPEN and task.status != Task.STATUS_OPEN:
                return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        task.status = status
        task.save(update_fields=['status', 'updated_at'])

        fresh = task_queryset().filter(id=task.id).first()

        return JsonResponse({'success': True, 'task': task_payload(fresh, employee, manage, open_counts())})


class TaskDeleteView(View):
    def post(self, request, task_id):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        if not can_manage(employee):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        task = Task.objects.filter(id=task_id).first()

        if task is None:
            return JsonResponse({'error': 'Задача не найдена'}, status=404)

        task.delete()

        return JsonResponse({'success': True})


class TaskCommentView(View):
    def post(self, request, task_id):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        manage = can_manage(employee)
        task = Task.objects.filter(id=task_id).first()

        if task is None:
            return JsonResponse({'error': 'Задача не найдена'}, status=404)

        if not can_view(employee, task, manage):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        text = (request.POST.get('text') or '').strip()

        if not text:
            return JsonResponse({'error': 'Введите комментарий'}, status=400)

        comment = TaskComment.objects.create(task=task, author=employee, text=text[:2000])

        return JsonResponse({'success': True, 'comment': comment_payload(comment)})


class TasksBadgeView(View):
    def get(self, request):
        employee = current_employee(request)

        if employee is None:
            return JsonResponse({'count': 0})

        return JsonResponse({'count': my_open_count(employee)})
