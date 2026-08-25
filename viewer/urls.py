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
    path('orders/', views.OrdersView.as_view(), name='orders'),
    path('schedule/', views.ScheduleView.as_view(), name='schedule'),
    path('employees/', views.IndexView.as_view(), name='employees'),
    path('reports/', views.IndexView.as_view(), name='reports'),
]