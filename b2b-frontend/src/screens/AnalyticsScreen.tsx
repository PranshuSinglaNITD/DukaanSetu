import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, ActivityIndicator,
  Dimensions, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

const W = Dimensions.get('window').width;

// ─── Animated entrance ────────────────────────────────────────────────────────
const FadeIn = ({ children, delay = 0 }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay,          useNativeDriver: true, speed: 14, bounciness: 7 }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>{children}</Animated.View>;
};

// ─── Single KPI card ──────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, bg, delay }: any) => (
  <FadeIn delay={delay}>
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: color + '22' }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  </FadeIn>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AnalyticsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [data,    setData]    = useState<any>(null);
  const [period,  setPeriod]  = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await apiClient.get('/analytics');
      setData(res.data);
    } catch (e) {
      console.error('Analytics fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loaderText}>Compiling Mandi Ledgers…</Text>
      </View>
    );
  }

  const { summary, charts } = data;
  const isProfit = summary.netProfitOrLoss >= 0;

  const PERIODS = ['week', 'month', 'year'] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <MaterialCommunityIcons name="chart-line" size={16} color="#059669" />
          <Text style={styles.headerTitle}>MandiBrain Analytics</Text>
        </View>
        <TouchableOpacity style={styles.backBtn}>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero profit card ── */}
        <FadeIn delay={0}>
          <LinearGradient
            colors={isProfit ? ['#052e16', '#065f46', '#0a7a57'] : ['#450a0a', '#7f1d1d', '#991b1b']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlob} />
            <Text style={styles.heroLabel}>NET BUSINESS YIELD</Text>
            <Text style={styles.heroValue}>
              {isProfit ? '+' : ''}₹{summary.netProfitOrLoss.toLocaleString('en-IN')}
            </Text>
            <View style={styles.heroRow}>
              <View style={styles.heroPill}>
                <MaterialCommunityIcons
                  name={isProfit ? 'trending-up' : 'trending-down'}
                  size={12} color={isProfit ? '#34d399' : '#fca5a5'}
                />
                <Text style={[styles.heroPillText, { color: isProfit ? '#34d399' : '#fca5a5' }]}>
                  {isProfit ? 'Profitable' : 'Loss'} · {summary.profitMargin}% margin
                </Text>
              </View>
            </View>

            {/* Inline mini stats */}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>₹{summary.totalRevenue.toLocaleString('en-IN')}</Text>
                <Text style={styles.heroStatLbl}>Revenue</Text>
              </View>
              <View style={styles.heroStatSep} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>₹{summary.totalExpenses.toLocaleString('en-IN')}</Text>
                <Text style={styles.heroStatLbl}>Expenses</Text>
              </View>
              <View style={styles.heroStatSep} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>{summary.totalOrders ?? '—'}</Text>
                <Text style={styles.heroStatLbl}>Orders</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* ── KPI grid ── */}
        <View style={styles.kpiGrid}>
          <KpiCard delay={80}  label="Avg Deal Size"   value={`₹${(summary.avgDealSize ?? 0).toLocaleString('en-IN')}`}  icon="handshake-outline"    color="#3b82f6" bg="#eff6ff" />
          <KpiCard delay={140} label="Active Listings" value={summary.activeListings ?? '—'}                              icon="tag-multiple-outline"  color="#8b5cf6" bg="#f5f3ff" />
          <KpiCard delay={200} label="New Buyers"      value={summary.newBuyers ?? '—'}                                   icon="account-plus-outline"  color="#f59e0b" bg="#fffbeb" />
          <KpiCard delay={260} label="Repeat Buyers"   value={`${summary.repeatBuyerPct ?? 0}%`}                          icon="account-sync-outline"  color="#059669" bg="#ecfdf5" />
        </View>

        {/* ── Period toggle ── */}
        <FadeIn delay={300}>
          <View style={styles.periodRow}>
            <Text style={styles.sectionTitle}>Revenue & Profit Trend</Text>
            <View style={styles.periodToggle}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* ── Line chart ── */}
        <FadeIn delay={360}>
          <View style={styles.chartCard}>
            <LineChart
              data={{
                labels: charts.lineChart.labels,
                datasets: [
                  { data: charts.lineChart.revenue, color: (o = 1) => `rgba(5,150,105,${o})`,   strokeWidth: 3 },
                  { data: charts.lineChart.profit,  color: (o = 1) => `rgba(251,191,36,${o})`,  strokeWidth: 2 },
                ],
                legend: ['Revenue', 'Net Profit'],
              }}
              width={W - 64}
              height={200}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (o = 1) => `rgba(30,41,59,${o})`,
                labelColor: (o = 1) => `rgba(100,116,139,${o})`,
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#059669' },
                propsForBackgroundLines: { stroke: '#f1f5f9', strokeDasharray: '' },
              }}
              bezier
              style={{ borderRadius: 12 }}
              withInnerLines
              withOuterLines={false}
            />
          </View>
        </FadeIn>

        {/* ── Pie chart ── */}
        <FadeIn delay={420}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Commodity Volume Split</Text>
            <PieChart
              data={charts.pieChart}
              width={W - 64}
              height={180}
              chartConfig={{ color: (o = 1) => `rgba(0,0,0,${o})` }}
              accessor="volume"
              backgroundColor="transparent"
              paddingLeft="10"
              absolute
            />
          </View>
        </FadeIn>

        {/* ── Top commodities list ── */}
        {charts.topCommodities?.length > 0 && (
          <FadeIn delay={480}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Top Commodities by Revenue</Text>
              {charts.topCommodities.map((item: any, i: number) => (
                <View key={item.name} style={styles.commRow}>
                  <View style={styles.commRank}>
                    <Text style={styles.commRankText}>#{i + 1}</Text>
                  </View>
                  <MaterialCommunityIcons name="grain" size={16} color="#059669" style={{ marginRight: 10 }} />
                  <Text style={styles.commName}>{item.name}</Text>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <View style={styles.commBarBg}>
                      <View style={[styles.commBarFill, { width: `${item.pct}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.commVal}>₹{item.revenue.toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>
          </FadeIn>
        )}

        {/* ── Insight card ── */}
        <FadeIn delay={520}>
          <LinearGradient colors={['#fffbeb', '#fef3c7']} style={styles.insightCard}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#d97706" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.insightLabel}>AI INSIGHT</Text>
              <Text style={styles.insightText}>
                Your profit margin is <Text style={{ fontWeight: '700' }}>{summary.profitMargin}%</Text>.
                Top performers in your region average <Text style={{ fontWeight: '700' }}>22%</Text> — consider renegotiating your Wheat procurement costs.
              </Text>
            </View>
          </LinearGradient>
        </FadeIn>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5efe6' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5efe6', gap: 12 },
  loaderText: { fontSize: 13, color: '#059669', fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: -0.2 },

  scroll: { padding: 16 },

  // ── Hero ──
  heroCard: {
    borderRadius: 24, padding: 22, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#052e16', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  heroBlob: {
    position: 'absolute', right: -40, top: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  heroLabel: { color: '#6ee7b7', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 10 },
  heroRow:  { flexDirection: 'row', marginBottom: 18 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  heroPillText: { fontSize: 11, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 12 },
  heroStat:  { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  heroStatLbl: { color: '#a7f3d0', fontSize: 9, fontWeight: '500', marginTop: 3 },
  heroStatSep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── KPI grid ──
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  kpiCard: {
    width: (W - 42) / 2, padding: 14, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4 },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 3 },

  // ── Period toggle ──
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: -0.2 },
  periodToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  periodBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  periodText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  periodTextActive: { color: '#0f172a', fontWeight: '800' },

  // ── Charts ──
  chartCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  chartTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 14, letterSpacing: -0.1 },

  // ── Commodities ──
  commRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  commRank: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  commRankText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  commName: { fontSize: 13, fontWeight: '700', color: '#1e293b', width: 70 },
  commBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  commBarFill: { height: 6, backgroundColor: '#059669', borderRadius: 4 },
  commVal: { fontSize: 12, fontWeight: '700', color: '#1e293b' },

  // ── Insight ──
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#fde68a',
  },
  insightLabel: { fontSize: 9, fontWeight: '800', color: '#92400e', letterSpacing: 1.2, marginBottom: 4 },
  insightText:  { fontSize: 12, color: '#78350f', lineHeight: 18 },
});