from django.contrib.auth.models import User
from django.db import transaction

from viewer.models import (
    Agency, ArtistCard, Client, Employee, MoneyAccrual, MoneyPayout, Order,
    OrderEmployee, OrderEstimate, Service, ServiceStaffRow, TransportTicket,
)
from viewer.views.clients_import import import_clients
from viewer.views.employees_import import import_employees
from viewer.views.orders_import import import_orders
from viewer.views.services_import import import_services


def create_users():
    return import_employees()


def create_services():
    return import_services()


def create_clients():
    return import_clients()


def create_orders():
    return import_orders()


def clear_orders():
    with transaction.atomic():
        count = Order.objects.count()

        MoneyAccrual.objects.filter(order__isnull=False).delete()
        MoneyPayout.objects.all().delete()
        TransportTicket.objects.all().delete()
        OrderEstimate.objects.all().delete()
        OrderEmployee.objects.all().delete()
        Order.objects.all().delete()

    return count


def delete_orders():
    count = clear_orders()

    return {
        'created': 0,
        'skipped': 0,
        'deleted': count,
        'message': f'Удалено заказов: {count}',
    }


def delete_clients():
    with transaction.atomic():
        orders_deleted = clear_orders()

        client_count = Client.objects.count()
        Client.objects.all().delete()

        Agency.objects.filter(clients__isnull=True).delete()

    return {
        'created': 0,
        'skipped': 0,
        'deleted': client_count,
        'message': f'Удалено клиентов: {client_count}, вместе с ними заказов: {orders_deleted}',
    }


def delete_services():
    with transaction.atomic():
        used_by_orders = list(
            OrderEstimate.objects
            .exclude(service__isnull=True)
            .values_list('order_id', flat=True)
            .distinct()
        )

        released_orders = 0

        for order_id in used_by_orders:
            estimate_items = OrderEstimate.objects.filter(order_id=order_id)

            if estimate_items.exclude(service__isnull=True).exists():
                estimate_items.update(service=None)
                released_orders += 1

        ServiceStaffRow.objects.all().delete()

        service_count = Service.objects.count()
        Service.objects.all().delete()

    return {
        'created': 0,
        'skipped': 0,
        'deleted': service_count,
        'message': f'Удалено услуг и каталогов: {service_count}. Отвязаны от заказов: {released_orders}',
    }


def delete_employees():
    protected = list(User.objects.filter(is_superuser=True).values_list('id', flat=True))
    owner = Employee.objects.filter(user_id__in=protected).first()

    with transaction.atomic():
        staff = list(Employee.objects.exclude(user_id__in=protected))
        staff_ids = [employee.id for employee in staff]

        MoneyAccrual.objects.filter(employee_id__in=staff_ids).delete()
        MoneyPayout.objects.filter(employee_id__in=staff_ids).delete()
        ArtistCard.objects.filter(employee_id__in=staff_ids).delete()

        Client.objects.filter(created_by_id__in=staff_ids).update(created_by_id=owner.id if owner else None)

        OrderEmployee.objects.filter(employee_id__in=staff_ids).update(employee=None)
        Order.objects.filter(manager_id__in=staff_ids).update(manager=None)
        Order.objects.filter(story_manager_id__in=staff_ids).update(story_manager=None)

        user_ids = [employee.user_id for employee in staff]

        Employee.objects.filter(id__in=staff_ids).delete()
        User.objects.filter(id__in=user_ids).delete()

    return {
        'created': 0,
        'skipped': 0,
        'deleted': len(staff_ids),
        'message': f'Удалено сотрудников: {len(staff_ids)}. Суперпользователь сохранён',
    }
