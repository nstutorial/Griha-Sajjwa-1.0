import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wallet, 
  TrendingUp, 
  Users, 
  DollarSign,
  LogOut,
  ShoppingCart
} from 'lucide-react';
import ExpensesListEnhanced from '@/components/ExpensesListEnhanced';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import LoansList from '@/components/LoansList';
import AddLoanDialog from '@/components/AddLoanDialog';
import CustomersList from '@/components/CustomersList';
import AddCustomerDialog from '@/components/AddCustomerDialog';
import DaywisePayment from '@/components/DaywisePayment';
import DateWisePayments from '@/components/DateWisePayments';
import SalesList from '@/components/SalesList';
import AddSaleDialog from '@/components/AddSaleDialog';
import SaleCustomersList from '@/components/SaleCustomersList';
import { TabSettings } from '@/pages/Settings';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface DashboardStats {
  totalExpenses: number;
  totalLoaned: number;
  totalReceived: number;
  activeLoans: number;
}

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    totalLoaned: 0,
    totalReceived: 0,
    activeLoans: 0,
  });
  const [activeTab, setActiveTab] = useState('expenses');
  const [showProfile, setShowProfile] = useState(false);
  const [tabSettings, setTabSettings] = useState<TabSettings>({
    expenses: true,
    loans: true,
    customers: true,
    sales: true,
    daywise: true,
    payments: true,
  });

  // Define functions before using them in useEffect
  const fetchTabSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('visible_tabs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching tab settings:', error);
        return;
      }

      if (data) {
        setTabSettings(data.visible_tabs as unknown as TabSettings);
      } else {
        // If no settings exist, create default settings
        const defaultSettings = {
          expenses: true,
          loans: true,
          customers: true,
          sales: true,
          daywise: true,
          payments: true,
        };
        
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: defaultSettings,
          });

        if (insertError) {
          console.error('Error creating default settings:', insertError);
        } else {
          setTabSettings(defaultSettings);
        }
      }
    } catch (error) {
      console.error('Error in fetchTabSettings:', error);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Get total expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id);
      
      const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      // Get loans data
      const { data: loans } = await supabase
        .from('loans')
        .select('principal_amount, is_active')
        .eq('user_id', user.id);
      
      const totalLoaned = loans?.reduce((sum, loan) => sum + Number(loan.principal_amount), 0) || 0;
      const activeLoans = loans?.filter(loan => loan.is_active).length || 0;

      // Get total received from loan transactions
      const { data: transactions } = await supabase
        .from('loan_transactions')
        .select('amount, loans!inner(user_id)')
        .eq('loans.user_id', user.id);
      
      const totalReceived = transactions?.reduce((sum, trans) => sum + Number(trans.amount), 0) || 0;

      setStats({
        totalExpenses,
        totalLoaned,
        totalReceived,
        activeLoans,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  // All hooks must be called before any early returns
  useEffect(() => {
    if (user) {
      fetchTabSettings();
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [user]);
  
  // Show loading spinner while auth is loading
  if (loading) {
    return <LoadingSpinner message="Initializing your dashboard..." size="lg" />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar
          onSettingsClick={() => navigate('/settings')}
          onProfileClick={() => setShowProfile(true)}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b bg-card">
            <div className="w-full px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <SidebarTrigger />
                  <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">MoneyTracker Pro</h1>
                </div>
                <Button variant="outline" onClick={handleSignOut} className="text-xs sm:text-sm">
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            </div>
          </div>

      <div className="w-full px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="p-3 sm:p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Total Expenses</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-destructive truncate">
                ₹{stats.totalExpenses.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 sm:p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Total Loaned</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 truncate">
                ₹{stats.totalLoaned.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 sm:p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Total Received</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 truncate">
                ₹{stats.totalReceived.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 sm:p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Active Loans</CardTitle>
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.activeLoans}</div>
            </CardContent>
          </Card>
        </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="grid w-full min-w-max" style={{ gridTemplateColumns: `repeat(${Object.values(tabSettings).filter(Boolean).length}, 1fr)` }}>
                {tabSettings.expenses && <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>}
                {tabSettings.loans && <TabsTrigger value="loans" className="text-xs sm:text-sm">Loans</TabsTrigger>}
                {tabSettings.customers && <TabsTrigger value="customers" className="text-xs sm:text-sm">Customers</TabsTrigger>}
                {tabSettings.sales && (
                  <>
                    <TabsTrigger value="sales" className="text-xs sm:text-sm">
                      <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Sales</span>
                      <span className="sm:hidden">Sales</span>
                    </TabsTrigger>
                    <TabsTrigger value="sale-customers" className="text-xs sm:text-sm">
                      <span className="hidden sm:inline">Sale Customers</span>
                      <span className="sm:hidden">S. Customers</span>
                    </TabsTrigger>
                  </>
                )}
                {tabSettings.daywise && <TabsTrigger value="daywise" className="text-xs sm:text-sm">Daywise</TabsTrigger>}
                {tabSettings.payments && <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>}
              </TabsList>
            </div>

            {tabSettings.expenses && (
              <TabsContent value="expenses" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Your Expenses & Earnings</h2>
                  {/* <AddExpenseDialog onExpenseAdded={fetchStats} /> */}
                </div>
                <ExpensesListEnhanced />
              </TabsContent>
            )}

            {tabSettings.loans && (
              <TabsContent value="loans" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Loans & Lending</h2>
                  <AddLoanDialog onLoanAdded={fetchStats} />
                </div>
                <LoansList onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.customers && (
              <TabsContent value="customers" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Customers</h2>
                  <AddCustomerDialog onCustomerAdded={() => {
                    // Trigger refresh for any components that need it
                    window.dispatchEvent(new CustomEvent('refresh-customers'));
                  }} />
                </div>
                <CustomersList onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.sales && (
              <>
                <TabsContent value="sales" className="space-y-4 mt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Sales</h2>
                    <AddSaleDialog onSaleAdded={fetchStats} />
                  </div>
                  <SalesList onUpdate={fetchStats} />
                </TabsContent>

                <TabsContent value="sale-customers" className="space-y-4 mt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Sale Customers</h2>
                  </div>
                  <SaleCustomersList />
                </TabsContent>
              </>
            )}

            {tabSettings.daywise && (
              <TabsContent value="daywise" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Daywise Payment Schedule</h2>
                  <AddCustomerDialog onCustomerAdded={() => {
                    window.dispatchEvent(new CustomEvent('refresh-customers'));
                  }} />
                </div>
                <DaywisePayment onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.payments && (
              <TabsContent value="payments" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Date-wise Payment Records</h2>
                </div>
                <DateWisePayments onUpdate={fetchStats} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

    </div>
    </SidebarProvider>
  );
};

export default Dashboard;
