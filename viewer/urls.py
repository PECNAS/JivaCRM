from django.urls import path
from .views import (
    IndexView, LoginView, LogoutView,
    ClientsView, ClientDetailView, ClientUpdateView, ClientListView,
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    OrdersView, OrderDetailView, OrderUpdateView, OrderListView,
    ScheduleView, AgencyCreateView
)

urlpatterns = [
    path('', IndexView.as_view(), name='index'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Агентства
    path('agencies/', AgencyCreateView.as_view(), name='agency_create'),
    
    # Клиенты
    path('clients/', ClientsView.as_view(), name='clients'),
    path('clients/list/', ClientListView.as_view(), name='client_list'),
    path('clients/<int:client_id>/', ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:client_id>/update/', ClientUpdateView.as_view(), name='client_update'),
    
    # Сотрудники
    path('employees/', EmployeesView.as_view(), name='employees'),
    path('employees/list/', EmployeeListView.as_view(), name='employee_list'),
    path('employees/<int:employee_id>/', EmployeeDetailView.as_view(), name='employee_detail'),
    path('employees/<int:employee_id>/update/', EmployeeUpdateView.as_view(), name='employee_update'),
    path('employees/<int:employee_id>/delete/', EmployeeDeleteView.as_view(), name='employee_delete'),
    
    # Заказы
    path('orders/', OrdersView.as_view(), name='orders'),
    path('orders/list/', OrderListView.as_view(), name='order_list'),
    path('orders/<int:order_id>/', OrderDetailView.as_view(), name='order_detail'),
    path('orders/<int:order_id>/update/', OrderUpdateView.as_view(), name='order_update'),
    
    # Расписание
    path('schedule/', ScheduleView.as_view(), name='schedule'),
]