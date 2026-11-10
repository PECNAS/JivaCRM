from .base import IndexView, LoginView, LogoutView, ManifestView
from .clients import (
    ClientsView, ClientDetailView, ClientUpdateView, ClientDeleteView,
    ClientListView, ClientDeleteMatchedView, AgencyCreateView, CityCatalogView, AgencyCatalogView,
    AgencyAliasView, AgencyManagerView, AgencyManagerListView,
)
from .employees import (
    EmployeesView, EmployeeDetailView, EmployeeUpdateView, EmployeeDeleteView, EmployeeListView,
    EmployeeDocumentsView, EmployeeDocumentDeleteView,
    ArtistCardDetailView, ArtistCardUpdateView, ServicesForArtistCardView,
)
from .orders import (
    OrdersView, OrderDetailView, OrderUpdateView, OrderDeleteView, OrderListView, OrderCopyView,
    OrderPaymentView, OrderChecklistView, OrderFeedbackView, OrderFeedbackStatusView,
    FeedbackListView, ChecklistTemplateListView, CityCreateForOrderView,
    ServicePriceForOrderView, ServicesFlatListView, ServiceEmployeesForOrderView,
    CityListView, PricePeriodView, CityGroupsView, OrderExpenseView,
)
from .schedule import ScheduleView, MyOrdersListView
from .checklists import (
    ChecklistsPageView, ChecklistTemplateCreateView, ChecklistTemplateDetailView, ChecklistItemView,
    ChecklistSectionView, ChecklistItemsOrderView,
)
from .services import (
    ServicesView, ServiceTreeView, ServiceCreateView, ServiceDetailView,
    ServiceUpdateView, ServiceDeleteView,
)
from .profile import (
    ProfileView, ProfileDetailView, ProfileUpdateView, ProfileScheduleView, ProfileTicketsView,
    ProfilePaymentsView, ProfileCredentialsView,
)
from .money import (
    MoneyView, MoneyDataView, MoneyOrderPaymentView, MoneyOrderPayView,
    MoneyAccrualView, MoneyPayoutView, MoneyEmployeeDetailView, MoneyPayoutListView,
    MoneyPayoutAllView, MoneyExpenseStatusView,
)
from .fill_data import FillDataView
from .availability import (
    AvailabilityView, AvailabilityDetailView, AvailabilityScheduleView, AvailabilityByDateView,
)
from .reports import ReportsView
