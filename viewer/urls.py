from django.urls import path
from .views import (
    IndexView, LoginView, LogoutView,
    ClientsView, ClientDetailView, ClientUpdateView, ClientDeleteView, ClientListView, AgencyCreateView,
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    ArtistCardDetailView, ArtistCardUpdateView, ServicesForArtistCardView,
    OrdersView, OrderDetailView, OrderUpdateView, OrderDeleteView, OrderListView,
    ScheduleView, MyOrdersListView,
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView,
    CityListView,
    ServicePriceForOrderView, ServicesFlatListView, ServiceEmployeesForOrderView,
    ProfileView, ProfileDetailView, ProfileScheduleView, ProfileTicketsView,
)

urlpatterns = [
    path('', IndexView.as_view(), name='index'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),

    path('schedule/', ScheduleView.as_view(), name='schedule'),
    path('schedule/my-orders/', MyOrdersListView.as_view(), name='my_orders'),

    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/detail/', ProfileDetailView.as_view(), name='profile_detail'),
    path('profile/schedule/', ProfileScheduleView.as_view(), name='profile_schedule'),
    path('profile/tickets/', ProfileTicketsView.as_view(), name='profile_tickets'),

    path('agencies/', AgencyCreateView.as_view(), name='agency_create'),

    path('clients/', ClientsView.as_view(), name='clients'),
    path('clients/list/', ClientListView.as_view(), name='client_list'),
    path('clients/<int:client_id>/', ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:client_id>/update/', ClientUpdateView.as_view(), name='client_update'),
    path('clients/<int:client_id>/delete/', ClientDeleteView.as_view(), name='client_delete'),

    path('employees/', EmployeesView.as_view(), name='employees'),
    path('employees/list/', EmployeeListView.as_view(), name='employee_list'),
    path('employees/<int:employee_id>/', EmployeeDetailView.as_view(), name='employee_detail'),
    path('employees/<int:employee_id>/update/', EmployeeUpdateView.as_view(), name='employee_update'),
    path('employees/<int:employee_id>/delete/', EmployeeDeleteView.as_view(), name='employee_delete'),
    path('employees/<int:employee_id>/artist-card/', ArtistCardDetailView.as_view(), name='artist_card_detail'),
    path('employees/<int:employee_id>/artist-card/update/', ArtistCardUpdateView.as_view(), name='artist_card_update'),
    path('artist-card/services/', ServicesForArtistCardView.as_view(), name='artist_card_services'),

    path('orders/', OrdersView.as_view(), name='orders'),
    path('orders/list/', OrderListView.as_view(), name='order_list'),
    path('orders/cities/', CityListView.as_view(), name='order_cities'),
    path('orders/services/', ServicesFlatListView.as_view(), name='order_services'),
    path('orders/<int:order_id>/', OrderDetailView.as_view(), name='order_detail'),
    path('orders/<int:order_id>/update/', OrderUpdateView.as_view(), name='order_update'),
    path('orders/<int:order_id>/delete/', OrderDeleteView.as_view(), name='order_delete'),
    path('orders/services/<int:service_id>/price/', ServicePriceForOrderView.as_view(), name='order_service_price'),
    path('orders/services/<int:service_id>/employees/', ServiceEmployeesForOrderView.as_view(), name='order_service_employees'),

    path('services/', ServicesView.as_view(), name='services'),
    path('services/tree/', ServiceTreeView.as_view(), name='service_tree'),
    path('services/create/', ServiceCreateView.as_view(), name='service_create'),
    path('services/cities/', CityListView.as_view(), name='city_list'),
    path('services/<int:service_id>/', ServiceDetailView.as_view(), name='service_detail'),
    path('services/<int:service_id>/update/', ServiceUpdateView.as_view(), name='service_update'),
    path('services/<int:service_id>/delete/', ServiceDeleteView.as_view(), name='service_delete'),
]