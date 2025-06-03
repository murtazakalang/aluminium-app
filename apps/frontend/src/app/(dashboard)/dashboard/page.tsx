'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { dashboardService, DashboardMetrics, ChartDataPoint, RecentActivity, AlertItem } from '@/lib/api/dashboardService';
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  Package,
  TrendingUp,
  Clock,
  AlertTriangle,
  BarChart3,
  Calculator,
  PenTool
} from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import LineChart from '@/components/ui/LineChart';
import PieChart from '@/components/ui/PieChart';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClients: 0,
    activeQuotations: 0,
    ordersInProgress: 0,
    monthlyRevenue: 0,
    inventoryValue: 0,
    lowStockAlerts: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<ChartDataPoint[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<ChartDataPoint[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [quickStats, setQuickStats] = useState({
    conversionRate: 0,
    averageOrderValue: 0,
    manufacturingEfficiency: 0,
  });

  // Fetch dashboard data from service
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        const dashboardResult = await dashboardService.getDashboardData();
        
        if (dashboardResult.success && dashboardResult.data) {
          const data = dashboardResult.data;
          setMetrics(data.metrics || {
            totalClients: 0,
            activeQuotations: 0,
            ordersInProgress: 0,
            monthlyRevenue: 0,
            inventoryValue: 0,
            lowStockAlerts: 0,
          });
          setMonthlyRevenueData(data.monthlyRevenueData || []);
          setOrderStatusData(data.orderStatusData || []);
          setRecentActivity(data.recentActivity || []);
          setAlerts(data.alerts || []);
          setQuickStats(data.quickStats || {
            conversionRate: 0,
            averageOrderValue: 0,
            manufacturingEfficiency: 0,
          });
        } else {
          console.error('Failed to fetch dashboard data:', dashboardResult.error);
          // Keep default/empty values set in initial state
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Keep default/empty values set in initial state
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const quickActions = [
    {
      title: 'Add Client',
      icon: Users,
      href: '/dashboard/clients/new',
      color: 'text-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100'
    },
    {
      title: 'New Quotation',
      icon: FileText,
      href: '/dashboard/quotations/new',
      color: 'text-green-600',
      bg: 'bg-green-50 hover:bg-green-100'
    },
    {
      title: 'Add Inventory',
      icon: Package,
      href: '/dashboard/inventory/new',
      color: 'text-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100'
    },
    {
      title: 'Create Estimation',
      icon: PenTool,
      href: '/dashboard/estimations/new',
      color: 'text-orange-600',
      bg: 'bg-orange-50 hover:bg-orange-100'
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quotation': return FileText;
      case 'order': return ShoppingCart;
      case 'client': return Users;
      case 'invoice': return Calculator;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here&apos;s what&apos;s happening with your business today
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Clients"
          value={metrics.totalClients}
          icon={Users}
          iconClassName="text-blue-600"
          trend={{
            value: 12.5,
            isPositive: true,
            label: 'vs last month'
          }}
        />
        <KPICard
          title="Active Quotations"
          value={metrics.activeQuotations}
          icon={FileText}
          iconClassName="text-green-600"
          trend={{
            value: 8.2,
            isPositive: true,
            label: 'vs last month'
          }}
        />
        <KPICard
          title="Orders in Progress"
          value={metrics.ordersInProgress}
          icon={ShoppingCart}
          iconClassName="text-orange-600"
          trend={{
            value: 5.1,
            isPositive: false,
            label: 'vs last month'
          }}
        />
        <KPICard
          title="Monthly Revenue"
          value={`₹${(metrics.monthlyRevenue / 100000).toFixed(1)}L`}
          icon={TrendingUp}
          iconClassName="text-purple-600"
          trend={{
            value: 15.3,
            isPositive: true,
            label: 'vs last month'
          }}
        />
      </div>

      {/* Quick Actions Panel */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Button 
                  variant="outline" 
                  className={`h-20 w-full flex-col ${action.bg} border-gray-200 hover:border-gray-300 transition-all`}
                >
                  <Icon className={`h-6 w-6 mb-2 ${action.color}`} />
                  <span className="text-sm font-medium text-gray-700">{action.title}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Charts and Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <LineChart
            data={monthlyRevenueData}
            xAxisKey="name"
            yAxisKey="revenue"
            title="Revenue Trend (Last 6 Months)"
            height={300}
            formatYAxis={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            formatTooltip={(value) => [`₹${(Number(value) / 100000).toFixed(2)}L`, 'Revenue']}
          />
        </Card>
        
        <Card className="p-6">
          <PieChart
            data={orderStatusData}
            dataKey="value"
            nameKey="name"
            title="Order Status Distribution"
            height={300}
            formatTooltip={(value, name) => [`${value} orders`, name]}
          />
        </Card>
      </div>

      {/* Recent Activity and Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                    <div className="flex-shrink-0">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {activity.subtitle}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {activity.status && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
                          {activity.status.replace('_', ' ')}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.timestamp}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <Link href="/dashboard/activity">
                <Button variant="outline" size="sm">
                  View All Activity
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Alerts and Quick Stats */}
        <div className="space-y-6">
          {/* Inventory Alerts */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              Alerts
            </h3>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const alertColors = {
                  'low_stock': 'bg-red-50 text-red-900 text-red-700 text-red-600 border-red-200',
                  'pending_quotation': 'bg-yellow-50 text-yellow-900 text-yellow-700 text-yellow-600 border-yellow-200',
                  'overdue_invoice': 'bg-orange-50 text-orange-900 text-orange-700 text-orange-600 border-orange-200',
                  'system': 'bg-blue-50 text-blue-900 text-blue-700 text-blue-600 border-blue-200'
                };
                
                const colorClass = alertColors[alert.type] || alertColors['system'];
                const [bgColor, titleColor, descColor, buttonColor, borderColor] = colorClass.split(' ');
                
                return (
                  <div key={alert.id} className={`flex items-center justify-between p-3 ${bgColor} rounded-lg`}>
                    <div>
                      <p className={`text-sm font-medium ${titleColor}`}>{alert.title}</p>
                      <p className={`text-xs ${descColor}`}>{alert.description}</p>
                    </div>
                    <Link href={alert.href || '#'}>
                      <Button size="sm" variant="outline" className={`${buttonColor} ${borderColor}`}>
                        View
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Inventory Value</span>
                <span className="text-sm font-semibold">₹{(metrics.inventoryValue / 100000).toFixed(1)}L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Conversion Rate</span>
                <span className="text-sm font-semibold text-green-600">{quickStats.conversionRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg. Order Value</span>
                <span className="text-sm font-semibold">₹{quickStats.averageOrderValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Manufacturing Efficiency</span>
                <span className="text-sm font-semibold text-blue-600">{quickStats.manufacturingEfficiency}%</span>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/dashboard/reports">
                <Button variant="outline" size="sm" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
} 