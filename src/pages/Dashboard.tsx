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
import SettingsDialog, { TabSettings } from '@/components/SettingsDialog';
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
  const [showSettings, setShowSettings] = useState(false);
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

    const { data } = await supabase
      .from('user_settings')
      .select('visible_tabs')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setTabSettings(data.visible_tabs as unknown as TabSettings);
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
      <div className="min-h-screen flex w-full">
        <AppSidebar
          onSettingsClick={() => setShowSettings(true)}
          onProfileClick={() => setShowProfile(true)}
        />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <SidebarTrigger />
                  <Wallet className="h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold">Expense Tracker</h1>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ₹{stats.totalExpenses.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Loaned</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ₹{stats.totalLoaned.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₹{stats.totalReceived.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeLoans}</div>
            </CardContent>
          </Card>
        </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.values(tabSettings).filter(Boolean).length}, 1fr)` }}>
              {tabSettings.expenses && <TabsTrigger value="expenses">Expenses</TabsTrigger>}
              {tabSettings.loans && <TabsTrigger value="loans">Loans</TabsTrigger>}
              {tabSettings.customers && <TabsTrigger value="customers">Customers</TabsTrigger>}
              {tabSettings.sales && (
                <>
                  <TabsTrigger value="sales">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Sales
                  </TabsTrigger>
                  <TabsTrigger value="sale-customers">Sale Customers</TabsTrigger>
                </>
              )}
              {tabSettings.daywise && <TabsTrigger value="daywise">Daywise</TabsTrigger>}
              {tabSettings.payments && <TabsTrigger value="payments">Payments</TabsTrigger>}
            </TabsList>

            {tabSettings.expenses && (
              <TabsContent value="expenses" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Your Expenses</h2>
                  <AddExpenseDialog onExpenseAdded={fetchStats} />
                </div>
                <ExpensesListEnhanced />
              </TabsContent>
            )}

            {tabSettings.loans && (
              <TabsContent value="loans" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Loans & Lending</h2>
                  <AddLoanDialog onLoanAdded={fetchStats} />
                </div>
                <LoansList onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.customers && (
              <TabsContent value="customers" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Customers</h2>
                  <AddCustomerDialog />
                </div>
                <CustomersList />
              </TabsContent>
            )}

            {tabSettings.sales && (
              <>
                <TabsContent value="sales" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Sales</h2>
                    <AddSaleDialog onSaleAdded={fetchStats} />
                  </div>
                  <SalesList onUpdate={fetchStats} />
                </TabsContent>

                <TabsContent value="sale-customers" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Sale Customers</h2>
                  </div>
                  <SaleCustomersList />
                </TabsContent>
              </>
            )}

            {tabSettings.daywise && (
              <TabsContent value="daywise" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Daywise Payment Schedule</h2>
                  <AddCustomerDialog />
                </div>
                <DaywisePayment onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.payments && (
              <TabsContent value="payments" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Date-wise Payment Records</h2>
                </div>
                <DateWisePayments onUpdate={fetchStats} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onSettingsUpdate={setTabSettings}
      />
    </div>
    </SidebarProvider>
  );
};

export default Dashboard;
