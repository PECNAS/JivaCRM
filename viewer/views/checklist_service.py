from django.db.models import Max

from ..models import (
    ChecklistItem, ChecklistTemplate, OrderShowTemplate,
)


def template_for_show(show):
    service = show.service

    if service is not None:
        template = (
            ChecklistTemplate.objects
            .filter(is_active=True, service=service)
            .prefetch_related('items')
            .order_by('name')
            .first()
        )

        if template is not None:
            return template

    for template in ChecklistTemplate.objects.filter(
        is_active=True,
        service__isnull=True,
    ).prefetch_related('items').order_by('name'):
        if template.matches_show(None, show.service_name):
            return template

    return None


def default_templates():
    return list(
        ChecklistTemplate.objects
        .filter(is_active=True, is_default=True)
        .prefetch_related('items')
        .order_by('name')
    )


def attach_template(order, template, employee, show=None):
    if template is None:
        return 0

    from django.db import transaction
    from ..models import Order as OrderModel

    with transaction.atomic():
        OrderModel.objects.select_for_update().filter(id=order.id).first()

        existing = ChecklistItem.objects.filter(order=order, template=template)

        if show is None:
            existing = existing.filter(show__isnull=True)
        else:
            existing = existing.filter(show=show)

        if existing.exists():
            return 0

        return add_template(order, template, employee, show)


def dedupe_order_checklist(order):
    rows = (
        ChecklistItem.objects
        .filter(order=order, template__isnull=False)
        .order_by('id')
        .values_list('id', 'template_id', 'show_id', 'text')
    )

    seen = {}
    extra_ids = []

    for item_id, template_id, show_id, text in rows:
        key = (template_id, show_id, text)

        if key in seen:
            extra_ids.append(item_id)
        else:
            seen[key] = item_id

    removed = 0

    for start in range(0, len(extra_ids), 500):
        chunk = extra_ids[start:start + 500]
        removed += len(chunk)
        ChecklistItem.objects.filter(id__in=chunk).delete()

    return removed


def add_template(order, template, employee, show=None):
    if template is None:
        return 0

    last = (
        ChecklistItem.objects
        .filter(order=order)
        .aggregate(value=Max('order_index'))
    )
    index = (last.get('value') if last.get('value') is not None else -1) + 1
    created = 0
    seen = set(
        ChecklistItem.objects
        .filter(order=order, template=template, show=show)
        .values_list('text', flat=True)
    )

    for source in template.items.order_by('order_index', 'id'):
        if source.text in seen:
            continue

        seen.add(source.text)

        ChecklistItem.objects.create(
            order=order,
            show=show,
            template=template,
            text=source.text,
            order_index=index,
            created_by=employee,
        )
        index += 1
        created += 1

    if created:
        order.show_templates.filter(template=template, is_detached=True).delete()

    return created


def is_template_detached(order, template):
    if template is None:
        return False

    return OrderShowTemplate.objects.filter(
        order=order,
        template=template,
        is_detached=True,
    ).exists()


def attach_for_order(order, employee):
    created = 0

    for show in order.estimate_items.all():
        template = template_for_show(show)

        if not template or is_template_detached(order, template):
            continue

        created += attach_template(order, template, employee, show)

    for template in default_templates():
        if is_template_detached(order, template):
            continue

        created += attach_template(order, template, employee, None)

    return created


def split_item_text(text):
    value = (text or '').strip()
    head, sep, tail = value.partition(':')

    if sep and head.strip() and len(head) <= 40 and tail.strip():
        return head.strip(), tail.strip()

    return '', value


def serialize_item(item):
    section, body = split_item_text(item.text)

    return {
        'id': item.id,
        'text': item.text,
        'section': section,
        'body': body,
        'is_done': item.is_done,
        'show_id': item.show_id,
        'show_name': item.show.service_name if item.show_id else '',
        'template_id': item.template_id,
        'template_name': item.template.name if item.template_id else '',
        'created_by': item.created_by.display_name if item.created_by else '',
    }


def serialize_checklist(order, can_edit, can_build=None):
    shows = [
        {'id': show.id, 'name': show.service_name}
        for show in order.estimate_items.all()[:50]
    ]

    if 'checklist_items' in getattr(order, '_prefetched_objects_cache', {}):
        source = order._prefetched_objects_cache['checklist_items']
    else:
        source = order.checklist_items.select_related('show', 'template', 'created_by')

    items = [
        serialize_item(item)
        for item in source
    ]

    groups = []
    by_template = {}

    for item in items:
        key = item['template_id']

        if key not in by_template:
            by_template[key] = {
                'template_id': item['template_id'],
                'show_id': item['show_id'],
                'name': item['template_name'] or 'Без шаблона',
                'items': [],
            }
            groups.append(key)

        by_template[key]['items'].append(item)

    result = []

    for key in groups:
        group = by_template[key]
        total = len(group['items'])
        done = len([entry for entry in group['items'] if entry['is_done']])

        sections = []
        by_section = {}

        for item in group['items']:
            section_key = item['section'] or ''

            if section_key not in by_section:
                by_section[section_key] = {
                    'title': section_key,
                    'items': [],
                    'total': 0,
                    'done': 0,
                }
                sections.append(section_key)

            bucket = by_section[section_key]
            bucket['items'].append(item)
            bucket['total'] += 1

            if item['is_done']:
                bucket['done'] += 1

        result.append({
            'template_id': group['template_id'],
            'show_id': group['show_id'],
            'name': group['name'],
            'items': group['items'],
            'sections': [by_section[key] for key in sections],
            'total': total,
            'done': done,
        })

    return {
        'items': items,
        'groups': result,
        'shows': shows,
        'can_edit': can_edit,
        'can_build': can_edit if can_build is None else can_build,
        'total': len(items),
        'done': len([item for item in items if item['is_done']]),
    }
