import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SaleCustomerDetails from './SaleCustomerDetails';

interface CustomerSale {
  id: string;
  name: string;
  phone: string | null;
  activeSales: number;
  totalSales: number;
}

const SaleCustomersList = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('user_id', user.id)
      .order('name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      setLoading(false);
      return;
    }

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('customer_id, sale_amount')
      .eq('user_id', user.id);

    if (salesError) {
      console.error('Error fetching sales:', salesError);
    }

    const customerSales = (customersData || []).map((customer) => {
      const sales = (salesData || []).filter((s) => s.customer_id === customer.id);
      return {
        ...customer,
        activeSales: sales.length,
        totalSales: sales.reduce((sum, s) => sum + Number(s.sale_amount), 0),
      };
    });

    setCustomers(customerSales);
    setLoading(false);
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchTerm))
  );

  if (loading) {
    return <div>Loading customers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No customers found
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <div>
                    <div>
                      {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                    </div>
                    {customer.phone && (
                      <div className="text-sm text-muted-foreground font-normal">
                        ID: {customer.phone}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Sales</p>
                    <p className="text-lg font-semibold text-primary">
                      ₹{customer.totalSales.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Active Sales</p>
                    <p className="text-lg font-semibold">{customer.activeSales}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={!!selectedCustomerId}
        onOpenChange={() => setSelectedCustomerId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Sale Details</DialogTitle>
          </DialogHeader>
          {selectedCustomerId && (
            <SaleCustomerDetails customerId={selectedCustomerId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaleCustomersList;
