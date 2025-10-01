import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SaleCustomerStatement from './SaleCustomerStatement';

interface Sale {
  id: string;
  sale_amount: number;
  sale_description: string;
  sale_date: string;
}

interface SaleTransaction {
  id: string;
  sale_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  notes: string | null;
}

interface Customer {
  name: string;
  phone: string | null;
  address: string | null;
}

interface SaleCustomerDetailsProps {
  customerId: string;
}

const SaleCustomerDetails = ({ customerId }: SaleCustomerDetailsProps) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [showStatement, setShowStatement] = useState(false);

  useEffect(() => {
    if (user && customerId) {
      fetchCustomerData();
    }
  }, [user, customerId]);

  const fetchCustomerData = async () => {
    if (!user) return;

    const { data: customerData } = await supabase
      .from('customers')
      .select('name, phone, address')
      .eq('id', customerId)
      .eq('user_id', user.id)
      .single();

    if (customerData) {
      setCustomer(customerData);
    }

    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', customerId)
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false });

    if (salesData) {
      setSales(salesData);
    }

    const { data: transactionsData } = await supabase
      .from('sale_transactions')
      .select(`
        *,
        sale:sales!inner(customer_id, user_id)
      `)
      .eq('sale.customer_id', customerId)
      .eq('sale.user_id', user.id)
      .order('payment_date', { ascending: false });

    if (transactionsData) {
      setTransactions(transactionsData);
    }
  };

  const totalSaleAmount = sales.reduce((sum, sale) => sum + Number(sale.sale_amount), 0);
  const totalPaid = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const outstanding = totalSaleAmount - totalPaid;

  return (
    <div className="space-y-4">
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div>
                <div>{customer.name}</div>
                {customer.phone && (
                  <div className="text-sm text-muted-foreground font-normal">
                    ID: {customer.phone}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => setShowStatement(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Statement
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-lg font-semibold text-primary">
                  ₹{totalSaleAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  ₹{totalPaid.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-lg font-semibold text-orange-600">
                  ₹{outstanding.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2">Sales</h3>
        {sales.map((sale) => (
          <Card key={sale.id} className="mb-2">
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{sale.sale_description}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-lg font-semibold text-primary">
                  ₹{sale.sale_amount.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showStatement} onOpenChange={setShowStatement}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Statement</DialogTitle>
          </DialogHeader>
          <SaleCustomerStatement customerId={customerId} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaleCustomerDetails;
