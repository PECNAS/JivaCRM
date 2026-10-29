from .base import IndexView, LoginView, LogoutView, ManifestView
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
    CityListView, PricePeriodView, CityGroupsView,
)
from .schedule import ScheduleView, MyOrdersListView
from .services import (
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView,
)
from .profile import (
    ProfileView, ProfileDetailView, ProfileUpdateView, ProfileScheduleView, ProfileTicketsView,
    ProfilePaymentsView,
)
from .money import (
    MoneyView, MoneyDataView, MoneyOrderPaymentView, MoneyOrderPayView,
    MoneyAccrualView, MoneyPayoutView, MoneyMonthPreviewView, MoneyMonthPayView,
)
from .fill_data import FillDataView