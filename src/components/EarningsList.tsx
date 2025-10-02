import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

interface Earning {
  id: string;
  amount: number;
  description: string;
  date: string;
  payment_method: 'cash' | 'bank';
  category: {
    name: string;
  } | null;
}

interface CategorySummary {
  category: string;
  total: number;
}

interface EarningsListProps {
  onRefresh?: () => void;
}

const EarningsList: React.FC<EarningsListProps> = ({ onRefresh }) => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user, onRefresh]);

  const fetchEarnings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        category:expense_categories(name)
      `)
      .eq('user_id', user.id)
      .eq('type', 'earning')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching earnings:', error);
    } else {
      setEarnings(data || []);
    }
    setLoading(false);
  };

  const filteredEarnings = earnings.filter((earning) => {
    const matchesSearch =
      earning.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (earning.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const earningDate = new Date(earning.date);
    const matchesDateFrom = !dateFrom || earningDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || earningDate <= new Date(dateTo);

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const categorySummary: CategorySummary[] = filteredEarnings.reduce((acc, earning) => {
    const category = earning.category?.name || 'Uncategorized';
    const existing = acc.find((item) => item.category === category);
    if (existing) {
      existing.total += Number(earning.amount);
    } else {
      acc.push({ category, total: Number(earning.amount) });
    }
    return acc;
  }, [] as CategorySummary[]);

  const totalEarnings = filteredEarnings.reduce(
    (sum, earning) => sum + Number(earning.amount),
    0
  );

  if (loading) {
    return <div>Loading earnings...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search earnings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          placeholder="From date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          placeholder="To date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categorySummary.map((item) => (
              <div key={item.category} className="flex justify-between items-center">
                <span className="text-sm">{item.category}</span>
                <span className="font-semibold text-green-600">₹{item.total.toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between items-center font-bold">
              <span>Total</span>
              <span className="text-green-600">₹{totalEarnings.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredEarnings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No earnings found
            </CardContent>
          </Card>
        ) : (
          filteredEarnings.map((earning) => (
            <Card key={earning.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{earning.description}</span>
                  <span className="text-green-600">₹{earning.amount.toFixed(2)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{earning.category?.name || 'Uncategorized'}</span>
                  <span>{format(new Date(earning.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Payment: {earning.payment_method}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EarningsList;
