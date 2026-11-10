from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views import View
import json

from ..models import ChecklistItem, ChecklistTemplate, Service
from .checklist_service import split_item_text


def resolve_employee(request):
    if not request.user.is_authenticated:
        return None

    return getattr(request.user, 'employee_profile', None)


def can_manage(employee):
    return employee is not None and employee.can_edit_checklists()


def serialize_template(template, with_items=True):
    data = {
        'id': template.id,
        'name': template.name,
        'service_id': template.service_id,
        'service_name': template.service.name if template.service_id else '',
        'is_default': template.is_default,
        'items_count': template.items.count(),
    }

    if with_items:
        data['items'] = [
            {'id': item.id, 'text': item.text, 'order_index': item.order_index}
            for item in template.items.all()
        ]

    return data


def load_template(template_id):
    if not template_id:
        return None

    value = str(template_id).strip()

    if not value.isdigit():
        return None

    return ChecklistTemplate.objects.filter(id=int(value)).first()


def template_response(template):
    template = (
        ChecklistTemplate.objects
        .select_related('service')
        .prefetch_related('items')
        .get(id=template.id)
    )

    return JsonResponse({'success': True, 'template': serialize_template(template)})


class ChecklistsPageView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')

        employee = resolve_employee(request)

        if not can_manage(employee):
            messages.error(request, 'У вас недостаточно прав для просмотра чек-листов')
            return redirect('index')

        templates = (
            ChecklistTemplate.objects
            .select_related('service')
            .prefetch_related('items')
            .order_by('name')
        )

        services = Service.objects.filter(type='service').order_by('name')

        templates_json = json.dumps(
            [serialize_template(template) for template in templates],
            ensure_ascii=False,
        ).replace('</', '<\\/')

        return render(request, 'checklists.html', {
            'employee': employee,
            'templates': templates,
            'services': services,
            'templates_json': templates_json,
        })


class ChecklistTemplateCreateView(View):
    def post(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        name = ' '.join(request.POST.get('name', '').split())

        if not name:
            return JsonResponse({'error': 'Название чек-листа обязательно'}, status=400)

        if ChecklistTemplate.objects.filter(name__iexact=name).exists():
            return JsonResponse({'error': 'Чек-лист с таким названием уже есть'}, status=400)

        service_id = request.POST.get('service_id', '').strip()
        service = Service.objects.filter(id=int(service_id)).first() if service_id.isdigit() else None

        template = ChecklistTemplate.objects.create(
            name=name,
            service=service,
            is_default=request.POST.get('is_default') in ('1', 'on', 'true'),
        )

        return template_response(template)


class ChecklistTemplateDetailView(View):
    def get(self, request, template_id):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        template = (
            ChecklistTemplate.objects
            .select_related('service')
            .prefetch_related('items')
            .filter(id=template_id)
            .first()
        )

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        return JsonResponse({'success': True, 'template': serialize_template(template)})

    def post(self, request, template_id):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        template = ChecklistTemplate.objects.filter(id=template_id).first()

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        name = ' '.join(request.POST.get('name', '').split())

        if not name:
            return JsonResponse({'error': 'Название чек-листа обязательно'}, status=400)

        if ChecklistTemplate.objects.filter(name__iexact=name).exclude(id=template.id).exists():
            return JsonResponse({'error': 'Чек-лист с таким названием уже есть'}, status=400)

        service_id = request.POST.get('service_id', '').strip()
        service = Service.objects.filter(id=int(service_id)).first() if service_id.isdigit() else None

        if service_id and service is None:
            return JsonResponse({'error': 'Шоу не найдено'}, status=400)

        template.name = name
        template.service = service
        template.is_default = request.POST.get('is_default') in ('1', 'on', 'true')
        template.save(update_fields=['name', 'service', 'is_default', 'updated_at'])

        return template_response(template)

    def delete(self, request, template_id):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        template = ChecklistTemplate.objects.filter(id=template_id).first()

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        template.delete()

        return JsonResponse({'success': True})


class ChecklistItemView(View):
    def post(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        template = load_template(request.POST.get('template_id'))

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        section = ' '.join(request.POST.get('section', '').split())
        text = ' '.join(request.POST.get('text', '').split())

        if not text:
            return JsonResponse({'error': 'Текст пункта обязателен'}, status=400)

        if not section:
            last_section = ''

            for source in template.items.order_by('order_index', 'id'):
                found_section, _ = split_item_text(source.text)

                if found_section:
                    last_section = found_section

            section = last_section

        full_text = f'{section}: {text}' if section else text

        item = ChecklistItem.objects.create(
            template=template,
            text=full_text[:500],
            order_index=template.items.count(),
            created_by=employee,
        )

        return JsonResponse({
            'success': True,
            'item': {'id': item.id, 'text': item.text, 'section': section},
        })

    def patch(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        payload = parse_json_body(request)

        if payload is None:
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        item = ChecklistItem.objects.filter(id=payload.get('id')).first()

        if item is None:
            return JsonResponse({'error': 'Пункт не найден'}, status=404)

        section = payload.get('section')
        body = payload.get('text')

        if section is None and body is None:
            return JsonResponse({'error': 'Нет данных для изменения'}, status=400)

        current_section, current_body = split_item_text(item.text)
        new_section = ' '.join(str(section).split()) if section is not None else current_section
        new_body = ' '.join(str(body).split()) if body is not None else current_body

        if not new_body:
            return JsonResponse({'error': 'Текст пункта обязателен'}, status=400)

        item.text = (f'{new_section}: {new_body}' if new_section else new_body)[:500]
        item.save(update_fields=['text', 'updated_at'])

        return JsonResponse({
            'success': True,
            'item': {'id': item.id, 'text': item.text, 'section': new_section, 'body': new_body},
        })

    def delete(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        item = ChecklistItem.objects.filter(id=request.GET.get('id')).first()

        if item is None:
            return JsonResponse({'error': 'Пункт не найден'}, status=404)

        item.delete()

        return JsonResponse({'success': True})


class ChecklistSectionView(View):
    def _apply(self, request, payload):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        if payload is None:
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        template = load_template(payload.get('template_id'))

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        section = ' '.join(str(payload.get('section') or '').split())
        title = ' '.join(str(payload.get('title') or '').split())
        changed = 0

        for item in template.items.all():
            current_section, body = split_item_text(item.text)

            if section:
                if current_section != section:
                    continue
            elif not current_section:
                continue

            new_text = f'{title}: {body}' if title else body

            if new_text and new_text != item.text:
                item.text = new_text[:500]
                item.save(update_fields=['text', 'updated_at'])
                changed += 1

        return JsonResponse({'success': True, 'changed': changed, 'section': title})

    def post(self, request):
        payload = {
            'template_id': request.POST.get('template_id'),
            'section': request.POST.get('section', ''),
            'title': request.POST.get('title', ''),
        }

        return self._apply(request, payload)

    def patch(self, request):
        return self._apply(request, parse_json_body(request))

    def delete(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        template = load_template(request.GET.get('template_id'))

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        section = ' '.join(request.GET.get('section', '').split())

        for item in template.items.all():
            current_section, _ = split_item_text(item.text)

            if current_section == section:
                item.delete()

        return JsonResponse({'success': True})


class ChecklistItemsOrderView(View):
    def post(self, request):
        employee = resolve_employee(request)

        if not can_manage(employee):
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        payload = parse_json_body(request)

        if payload is None:
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        template = load_template(payload.get('template_id'))

        if template is None:
            return JsonResponse({'error': 'Чек-лист не найден'}, status=404)

        ids = [str(value) for value in payload.get('ids', [])]
        items = {str(item.id): item for item in template.items.all()}

        index = 0

        for item_id in ids:
            item = items.pop(item_id, None)

            if item is None:
                continue

            if item.order_index != index:
                item.order_index = index
                item.save(update_fields=['order_index', 'updated_at'])

            index += 1

        return JsonResponse({'success': True})


def parse_json_body(request):
    try:
        return json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return None
