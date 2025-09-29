import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Trash2, MapPin, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CustomerDetails from './CustomerDetails';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
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
          loans (id, principal_amount, is_active)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
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

  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No customers added yet. Add your first customer!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {customers.map((customer) => {
        const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
        const totalLoaned = customer.loans?.reduce((sum, loan) => sum + Number(loan.principal_amount), 0) || 0;
        
        return (
          <Card key={customer.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{customer.name}</CardTitle>
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
              <div className="space-y-2">
                {customer.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customer.phone}</span>
                  </div>
                )}
                
                {customer.address && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customer.address}</span>
                  </div>
                )}
              </div>

              {totalLoaned > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Loaned</p>
                      <p className="font-semibold">₹{totalLoaned.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Loans</p>
                      <p className="font-semibold">{activeLoans.length}</p>
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