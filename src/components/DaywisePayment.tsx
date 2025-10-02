import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Phone, MapPin, IndianRupee, Eye, Clock } from 'lucide-react';
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

interface DaywisePaymentProps {
  onUpdate?: () => void;
}

const DaywisePayment: React.FC<DaywisePaymentProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const daysOfWeek = [
    'sunday',
    'monday', 
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];

  const dayLabels = {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday'
  };

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  useEffect(() => {
    const handleCustomerAdded = () => {
      fetchCustomers();
    };

    window.addEventListener('customer-added', handleCustomerAdded);
    return () => window.removeEventListener('customer-added', handleCustomerAdded);
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customers with their loans
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          loans:loans(id, principal_amount, is_active, interest_rate, interest_type, loan_date)
        `)
        .eq('user_id', user?.id)
        .order('name');

      if (customersError) throw customersError;

      // Fetch all loan transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans!inner(customer_id, user_id)
        `)
        .eq('loan.user_id', user?.id);

      if (transactionsError) throw transactionsError;

      setCustomers(customersData || []);
      setAllTransactions(transactionsData || []);
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

  const calculateLoanBalance = (customerId: string, loanId: string) => {
    const customerLoans = allTransactions.filter(t => t.loan.customer_id === customerId && t.loan_id === loanId);
    const totalPaid = customerLoans.reduce((sum, t) => sum + t.amount, 0);
    const loan = customers.find(c => c.id === customerId)?.loans?.find(l => l.id === loanId);
    return loan ? loan.principal_amount - totalPaid : 0;
  };

  const calculateInterest = (loan: any, balance: number) => {
    if (!loan.interest_rate || loan.interest_type === 'none') return 0;
    
    const rate = loan.interest_rate / 100;
    const startDate = new Date(loan.loan_date);
    const endDate = new Date();
    
    if (loan.interest_type === 'daily') {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateCustomerOutstanding = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      const balance = calculateLoanBalance(customer.id, loan.id);
      const interest = calculateInterest(loan, balance);
      return sum + balance + interest;
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getCustomersByDay = (day: string) => {
    return customers.filter(customer => customer.payment_day === day);
  };

  const getCurrentDay = () => {
    const today = new Date();
    const dayIndex = today.getDay();
    return daysOfWeek[dayIndex];
  };

  const getUpcomingDays = () => {
    const today = new Date();
    const currentDayIndex = today.getDay();
    const upcomingDays = [];
    
    for (let i = 0; i < 7; i++) {
      const dayIndex = (currentDayIndex + i) % 7;
      upcomingDays.push(daysOfWeek[dayIndex]);
    }
    
    return upcomingDays;
  };

  if (selectedCustomer) {
    return (
      <CustomerDetails 
        customer={selectedCustomer} 
        onBack={() => setSelectedCustomer(null)} 
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Daywise Payment Schedule</h2>
        <p className="text-muted-foreground">
          Customers organized by their preferred payment days
        </p>
      </div>

      {/* Current Day Highlight */}
      <Card className="border-primary">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-primary">Today - {dayLabels[getCurrentDay() as keyof typeof dayLabels]}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {getCustomersByDay(getCurrentDay()).length > 0 ? (
            <div className="grid gap-3">
              {getCustomersByDay(getCurrentDay()).map((customer) => {
                const outstandingBalance = calculateCustomerOutstanding(customer);
                return (
                  <div key={customer.id} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex-1 min-w-0 pr-3">
                      <div>
                        <p className="font-medium truncate">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-primary text-sm">{formatCurrency(outstandingBalance)}</p>
                        <Badge variant="outline" className="text-xs">
                          Outstanding
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCustomer(customer)}
                        className="flex-shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No customers scheduled for payment today
            </p>
          )}
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <div className="grid gap-4 w-full">
        {getUpcomingDays().map((day, index) => {
          const dayCustomers = getCustomersByDay(day);
          const isToday = day === getCurrentDay();
          
          return (
            <Card key={day} className={`w-full ${isToday ? "border-primary/50" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <CardTitle className="text-lg">
                      {dayLabels[day as keyof typeof dayLabels]}
                      {isToday && <Badge variant="default" className="ml-2">Today</Badge>}
                    </CardTitle>
                  </div>
                  <Badge variant="outline">
                    {dayCustomers.length} customer{dayCustomers.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {dayCustomers.length > 0 ? (
                  <div className="space-y-3">
                    {dayCustomers.map((customer) => {
                      const outstandingBalance = calculateCustomerOutstanding(customer);
                      return (
                        <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1 min-w-0 pr-3">
                            <div>
                              <p className="font-medium truncate">{customer.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                {customer.phone && (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <Phone className="h-3 w-3" />
                                    <span className="text-xs">{customer.phone}</span>
                                  </span>
                                )}
                                {customer.address && (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <MapPin className="h-3 w-3" />
                                    <span className="text-xs truncate">{customer.address}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-medium text-sm">{formatCurrency(outstandingBalance)}</p>
                              <Badge variant="outline" className="text-xs">
                                Outstanding
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedCustomer(customer)}
                              className="flex-shrink-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No customers scheduled for this day
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {daysOfWeek.map((day) => {
              const dayCustomers = getCustomersByDay(day);
              const totalOutstanding = dayCustomers.reduce((sum, customer) => {
                return sum + calculateCustomerOutstanding(customer);
              }, 0);
              
              return (
                <div key={day} className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground">
                    {dayLabels[day as keyof typeof dayLabels]}
                  </div>
                  <div className="text-lg font-bold">{dayCustomers.length}</div>
                  <div className="text-xs text-muted-foreground">customers</div>
                  <div className="text-sm font-medium text-green-600">
                    {formatCurrency(totalOutstanding)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DaywisePayment;
