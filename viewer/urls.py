from django.urls import path
from .views import (
    IndexView, LoginView, LogoutView,
    ClientsView, ClientDetailView, ClientUpdateView, ClientListView, AgencyCreateView,
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    OrdersView, OrderDetailView, OrderUpdateView, OrderDeleteView, OrderListView,
    ScheduleView,
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView, ServiceCalculationView, CityListView,
    ServicePriceForOrderView, ServicesFlatListView, ServiceEmployeesForOrderView,
)

urlpatterns = [
    path('', IndexView.as_view(), name='index'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),

    path('agencies/', AgencyCreateView.as_view(), name='agency_create'),

    path('clients/', ClientsView.as_view(), name='clients'),
    path('clients/list/', ClientListView.as_view(), name='client_list'),
    path('clients/<int:client_id>/', ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:client_id>/update/', ClientUpdateView.as_view(), name='client_update'),

    path('employees/', EmployeesView.as_view(), name='employees'),
    path('employees/list/', EmployeeListView.as_view(), name='employee_list'),
    path('employees/<int:employee_id>/', EmployeeDetailView.as_view(), name='employee_detail'),
    path('employees/<int:employee_id>/update/', EmployeeUpdateView.as_view(), name='employee_update'),
    path('employees/<int:employee_id>/delete/', EmployeeDeleteView.as_view(), name='employee_delete'),

    path('orders/', OrdersView.as_view(), name='orders'),
    path('orders/list/', OrderListView.as_view(), name='order_list'),
    path('orders/cities/', CityListView.as_view(), name='order_cities'),
    path('orders/services/', ServicesFlatListView.as_view(), name='order_services'),
    path('orders/<int:order_id>/', OrderDetailView.as_view(), name='order_detail'),
    path('orders/<int:order_id>/update/', OrderUpdateView.as_view(), name='order_update'),
    path('orders/<int:order_id>/delete/', OrderDeleteView.as_view(), name='order_delete'),
    path('orders/services/<int:service_id>/price/', ServicePriceForOrderView.as_view(), name='order_service_price'),
    path('orders/services/<int:service_id>/employees/', ServiceEmployeesForOrderView.as_view(), name='order_service_employees'),

    path('schedule/', ScheduleView.as_view(), name='schedule'),

    path('services/', ServicesView.as_view(), name='services'),
    path('services/tree/', ServiceTreeView.as_view(), name='service_tree'),
    path('services/create/', ServiceCreateView.as_view(), name='service_create'),
    path('services/cities/', CityListView.as_view(), name='city_list'),
    path('services/<int:service_id>/', ServiceDetailView.as_view(), name='service_detail'),
    path('services/<int:service_id>/update/', ServiceUpdateView.as_view(), name='service_update'),
    path('services/<int:service_id>/delete/', ServiceDeleteView.as_view(), name='service_delete'),
    path('services/<int:service_id>/calculate/', ServiceCalculationView.as_view(), name='service_calculate'),
]