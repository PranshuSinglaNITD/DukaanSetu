import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Dimensions, SafeAreaView } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import apiClient from '../api/client';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await apiClient.get('/analytics');
      setData(response.data);
    } catch (error) {
      console.error("Failed to load dashboard statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1B4D3E" />
        <Text style={styles.loaderText}>Compilating Mandi Ledgers...</Text>
      </View>
    );
  }

  const { summary, charts } = data;
  const isProfit = summary.netProfitOrLoss >= 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Fixed Branding Title */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="google-analytics" size={22} color="#1B4D3E" />
        <Text style={styles.headerTitle}>MandiBrain Financial Dash</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ==========================================
            1. CORE KPI CARDS GRID BLOCK
           ========================================== */}
        <View style={[styles.mainProfitCard, { backgroundColor: isProfit ? '#E8F5E9' : '#FEF2F2', borderColor: isProfit ? '#A3B899' : '#FCA5A5' }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabelText}>NET BUSINESS YIELD (PROFIT/LOSS)</Text>
            <Feather name={isProfit ? "trending-up" : "trending-down"} size={20} color={isProfit ? "#15803D" : "#B91C1C"} />
          </View>
          <Text style={[styles.profitValueText, { color: isProfit ? '#15803D' : '#B91C1C' }]}>
            ₹{summary.netProfitOrLoss.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.subMarginText}>Net Margin Rate: {summary.profitMargin}%</Text>
        </View>

        <View style={styles.kpiRowGrid}>
          <View style={styles.subKpiCard}>
            <Text style={styles.subKpiLabel}>TOTAL SALES REVENUE</Text>
            <Text style={[styles.subKpiValue, { color: '#1E3A8A' }]}>₹{summary.totalRevenue.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.subKpiCard}>
            <Text style={styles.subKpiLabel}>TOTAL INFLOW OUTDAYS</Text>
            <Text style={[styles.subKpiValue, { color: '#7C2D12' }]}>₹{summary.totalExpenses.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* ==========================================
            2. LINE TREND GRAPH LINE
           ========================================== */}
        <View style={styles.chartWrapperSection}>
          <Text style={styles.chartHeadingSection}>Monthly Revenue & Yield Matrix</Text>
          <LineChart
            data={{
              labels: charts.lineChart.labels,
              datasets: [
                {
                  data: charts.lineChart.revenue,
                  color: (opacity = 1) => `rgba(30, 58, 138, ${opacity})`, // Dark Blue line for revenue
                  strokeWidth: 3
                },
                {
                  data: charts.lineChart.profit,
                  color: (opacity = 1) => `rgba(27, 77, 62, ${opacity})`, // Forest Green line for margins
                  strokeWidth: 2
                }
              ],
              legend: ["Total Inflow Revenue", "Calculated Net Margin"]
            }}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#FFFFFF',
              backgroundGradientFrom: '#FFFFFF',
              backgroundGradientTo: '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(74, 85, 104, ${opacity})`,
              propsForDots: { r: '4', strokeWidth: '1', stroke: '#1B4D3E' }
            }}
            bezier
            style={styles.chartNativeStyle}
          />
        </View>

        {/* ==========================================
            3. PIE CHART DISTRIBUTION
           ========================================== */}
        <View style={styles.chartWrapperSection}>
          <Text style={styles.chartHeadingSection}>Top Commodity Sourcing Volume</Text>
          <PieChart
            data={charts.pieChart}
            width={screenWidth - 32}
            height={180}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
            }}
            accessor={"volume"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            center={[0, 0]}
            absolute
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 55, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', elevation: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1B4D3E', marginLeft: 8 },
  scrollContent: { padding: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loaderText: { marginTop: 12, fontSize: 13, color: '#1B4D3E', fontWeight: '500' },
  
  mainProfitCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabelText: { fontSize: 10, fontWeight: '700', color: '#4A5568', letterSpacing: 0.5 },
  profitValueText: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  subMarginText: { fontSize: 12, color: '#4A5568', marginTop: 4, fontWeight: '500' },
  
  kpiRowGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  subKpiCard: { width: '48%', backgroundColor: '#FFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  subKpiLabel: { fontSize: 9, fontWeight: '700', color: '#718096', letterSpacing: 0.3 },
  subKpiValue: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  
  chartWrapperSection: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  chartHeadingSection: { fontSize: 13, fontWeight: '700', color: '#1A202C', marginBottom: 14 },
  chartNativeStyle: { marginVertical: 8, borderRadius: 8 }
});