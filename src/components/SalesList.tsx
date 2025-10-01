import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Sale {
  id: string;
  customer_id: string;
  sale_amount: number;
  sale_description: string;
  sale_date: string;
  customer: {
    name: string;
    phone: string | null;
  };
}

interface SalesListProps {
  onUpdate?: () => void;
}

const SalesList = ({ onUpdate }: SalesListProps) => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);

  const fetchSales = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(name, phone)
      `)
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  const filteredSales = sales.filter(
    (sale) =>
      sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.sale_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading sales...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sales..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {filteredSales.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No sales found
            </CardContent>
          </Card>
        ) : (
          filteredSales.map((sale) => (
            <Card key={sale.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{sale.customer.name}</span>
                  <span className="text-primary">₹{sale.sale_amount.toFixed(2)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{sale.sale_description}</p>
                  <p className="text-xs">
                    Date: {new Date(sale.sale_date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesList;
