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
)
from .schedule import ScheduleView
from .services import (
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView, ServiceCalculationView, CityListView,
)
from .profile import (
    ProfileView, ProfileDetailView, ProfileScheduleView, ProfileTicketsView,
)