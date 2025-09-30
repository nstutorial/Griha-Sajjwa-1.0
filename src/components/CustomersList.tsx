import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Phone, Trash2, MapPin, Eye, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CustomerDetails from './CustomerDetails';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  loans?: Array<{
    id: string;
    principal_amount: number;
    is_active: boolean;
  }>;
}

const CustomersList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          loans (id, principal_amount, is_active, interest_rate, interest_type, loan_date)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);

      // Fetch all transactions for calculating outstanding balances
      if (data && data.length > 0) {
        const loanIds = data.flatMap(c => c.loans?.map(l => l.id) || []);
        if (loanIds.length > 0) {
          const { data: transData } = await supabase
            .from('loan_transactions')
            .select('*')
            .in('loan_id', loanIds);
          setAllTransactions(transData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch customers",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      // Check if customer has active loans
      const customer = customers.find(c => c.id === id);
      const hasActiveLoans = customer?.loans?.some(loan => loan.is_active);
      
      if (hasActiveLoans) {
        toast({
          variant: "destructive",
          title: "Cannot delete customer",
          description: "Customer has active loans. Complete all loans before deleting.",
        });
        return;
      }

      // Check if customer has any transactions
      const { data: transactions } = await supabase
        .from('loan_transactions')
        .select('id, loan:loans!inner(customer_id)')
        .eq('loan.customer_id', id);

      if (transactions && transactions.length > 0) {
        toast({
          variant: "destructive",
          title: "Cannot delete customer",
          description: "Customer has transaction history. Cannot delete customer with transactions.",
        });
        return;
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setCustomers(customers.filter(customer => customer.id !== id));
      toast({
        title: "Customer deleted",
        description: "The customer has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete customer",
      });
    }
  };

  const calculateLoanBalance = (loan: any) => {
    const loanTransactions = allTransactions.filter(t => t.loan_id === loan.id);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    return loan.principal_amount - totalPaid;
  };

  const calculateInterest = (loan: any, balance: number) => {
    if (!loan.interest_rate || loan.interest_type === 'none') return 0;
    
    const rate = loan.interest_rate / 100;
    const startDate = new Date(loan.loan_date);
    const endDate = new Date();
    
    if (loan.interest_type === 'daily') {
      // Daily interest calculation
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      // Monthly interest calculation
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30; // Approximate partial month
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateCustomerOutstanding = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      const balance = calculateLoanBalance(loan);
      const interest = calculateInterest(loan, balance);
      return sum + balance + interest;
    }, 0);
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.address?.toLowerCase().includes(query)
    );
  });

  if (selectedCustomer) {
    return (
      <CustomerDetails 
        customer={selectedCustomer} 
        onBack={() => setSelectedCustomer(null)} 
      />
    );
  }

  if (loading) {
    return <div>Loading customers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by name, phone, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredCustomers.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No customers found matching your search.' : 'No customers added yet. Add your first customer!'}
            </p>
          </CardContent>
        </Card>
      )}

      {filteredCustomers.map((customer) => {
        const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
        const totalLoaned = customer.loans?.reduce((sum, loan) => sum + Number(loan.principal_amount), 0) || 0;
        const outstandingBalance = calculateCustomerOutstanding(customer);
        const customerId = customer.phone || 'N/A';
        
        return (
          <Card key={customer.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    {customer.phone && (
                      <Badge variant="outline" className="text-xs">
                        {customer.phone}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Customer ID: {customerId}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {activeLoans.length > 0 && (
                    <Badge variant="default">
                      {activeLoans.length} Active Loan{activeLoans.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCustomer(customer.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.address && (
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.address}</span>
                </div>
              )}

              {customer.payment_day && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Payment Day: {customer.payment_day.charAt(0).toUpperCase() + customer.payment_day.slice(1)}
                  </span>
                </div>
              )}

              {totalLoaned > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Loaned</p>
                      <p className="font-semibold">₹{totalLoaned.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Loans</p>
                      <p className="font-semibold">{activeLoans.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                      <p className="font-semibold text-red-600">₹{outstandingBalance.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default CustomersList;
