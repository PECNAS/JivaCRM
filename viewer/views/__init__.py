from .base import IndexView, LoginView, LogoutView
from .clients import (
    ClientsView, ClientDetailView, ClientUpdateView, ClientDeleteView,
    ClientListView, AgencyCreateView,
)
from .employees import (
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    ArtistCardDetailView, ArtistCardUpdateView, ServicesForArtistCardView,
)
from .orders import (
    OrdersView, OrderDetailView, OrderUpdateView, OrderDeleteView, OrderListView,
    ServicePriceForOrderView, ServicesFlatListView, ServiceEmployeesForOrderView,
    CityListView,
)
from .schedule import ScheduleView, MyOrdersListView
from .services import (
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView,
)
from .profile import (
    ProfileView, ProfileDetailView, ProfileScheduleView, ProfileTicketsView,
)