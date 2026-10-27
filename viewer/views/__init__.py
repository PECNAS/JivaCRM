from .base import IndexView, LoginView, LogoutView
from .clients import (
    ClientsView, ClientDetailView, ClientUpdateView, ClientDeleteView,
    ClientListView, ClientDeleteMatchedView, AgencyCreateView, CityCatalogView, AgencyCatalogView,
)
from .employees import (
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    ArtistCardDetailView, ArtistCardUpdateView, ServicesForArtistCardView,
)
from .orders import (
    OrdersView, OrderDetailView, OrderUpdateView, OrderDeleteView, OrderListView, OrderCopyView,
    ServicePriceForOrderView, ServicesFlatListView, ServiceEmployeesForOrderView,
    CityListView, PricePeriodView,
)
from .schedule import ScheduleView, MyOrdersListView
from .services import (
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView,
)
from .profile import (
    ProfileView, ProfileDetailView, ProfileScheduleView, ProfileTicketsView,
)