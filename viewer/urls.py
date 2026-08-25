from django.urls import path
from . import views

urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('clients/', views.ClientsView.as_view(), name='clients'),
    path('clients/list/', views.ClientListView.as_view(), name='client_list'),
    path('clients/<int:client_id>/', views.ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:client_id>/update/', views.ClientUpdateView.as_view(), name='client_update'),
    path('employees/', views.EmployeesView.as_view(), name='employees'),
    path('employees/list/', views.EmployeeListView.as_view(), name='employee_list'),
    path('employees/<int:employee_id>/', views.EmployeeDetailView.as_view(), name='employee_detail'),
    path('employees/<int:employee_id>/update/', views.EmployeeUpdateView.as_view(), name='employee_update'),
    path('employees/<int:employee_id>/delete/', views.EmployeeDeleteView.as_view(), name='employee_delete'),
    path('orders/', views.OrdersView.as_view(), name='orders'),
    path('orders/list/', views.OrderListView.as_view(), name='order_list'),
    path('orders/<int:order_id>/', views.OrderDetailView.as_view(), name='order_detail'),
    path('orders/<int:order_id>/update/', views.OrderUpdateView.as_view(), name='order_update'),
    path('schedule/', views.ScheduleView.as_view(), name='schedule'),
    path('reports/', views.IndexView.as_view(), name='reports'),
]