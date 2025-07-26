"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateDailyAnalytics = exports.exportAnalyticsData = exports.getUsersPerformanceAnalytics = exports.getSalesFunnelAnalytics = exports.getCampaignsAnalytics = exports.getLeadsAnalytics = exports.getDashboardAnalytics = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ========== CLOUD FUNCTIONS PARA ANALYTICS ==========
/**
 * Obter dados de analytics do dashboard
 */
exports.getDashboardAnalytics = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager', 'viewer'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para acessar analytics');
    }
    // Calcular range de datas
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Buscar dados agregados
    const analyticsData = await getAnalyticsData(user.organizationId, startDate, endDate);
    // Buscar dados em tempo real se necessário
    const realtimeData = await getRealtimeAnalytics(user.organizationId, startDate, endDate);
    return Object.assign(Object.assign({ period: {
            range: data.dateRange,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        } }, analyticsData), realtimeData);
});
/**
 * Obter analytics de leads
 */
exports.getLeadsAnalytics = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Buscar leads no período
    let leadsQuery = db.collection('organizations')
        .doc(user.organizationId)
        .collection('leads')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate));
    // Aplicar filtros
    if ((_a = data.filters) === null || _a === void 0 ? void 0 : _a.source) {
        leadsQuery = leadsQuery.where('source', '==', data.filters.source);
    }
    if ((_b = data.filters) === null || _b === void 0 ? void 0 : _b.status) {
        leadsQuery = leadsQuery.where('status', '==', data.filters.status);
    }
    if ((_c = data.filters) === null || _c === void 0 ? void 0 : _c.assignedTo) {
        leadsQuery = leadsQuery.where('assignedTo', '==', data.filters.assignedTo);
    }
    const leadsSnapshot = await leadsQuery.get();
    const leads = leadsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Filtrar por tags se necessário
    let filteredLeads = leads;
    if (((_d = data.filters) === null || _d === void 0 ? void 0 : _d.tags) && data.filters.tags.length > 0) {
        filteredLeads = leads.filter(lead => data.filters.tags.some(tag => lead.tags.includes(tag)));
    }
    // Calcular métricas
    const analytics = calculateLeadsMetrics(filteredLeads, data.groupBy || 'day', startDate, endDate);
    return analytics;
});
/**
 * Obter analytics de campanhas
 */
exports.getCampaignsAnalytics = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Buscar campanhas no período
    let campaignsQuery = db.collection('organizations')
        .doc(user.organizationId)
        .collection('campaigns')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate));
    if (data.campaignType) {
        campaignsQuery = campaignsQuery.where('type', '==', data.campaignType);
    }
    const campaignsSnapshot = await campaignsQuery.get();
    const campaigns = campaignsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Calcular métricas de campanhas
    const analytics = calculateCampaignsMetrics(campaigns);
    return analytics;
});
/**
 * Obter analytics de funil de vendas
 */
exports.getSalesFunnelAnalytics = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Buscar leads no período
    const leadsSnapshot = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('leads')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    const leads = leadsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Calcular funil atual
    const currentFunnel = calculateSalesFunnel(leads);
    let previousFunnel = null;
    if (data.compareWithPrevious) {
        // Calcular período anterior
        const periodDuration = endDate.getTime() - startDate.getTime();
        const previousStartDate = new Date(startDate.getTime() - periodDuration);
        const previousEndDate = new Date(startDate.getTime() - 1);
        const previousLeadsSnapshot = await db.collection('organizations')
            .doc(user.organizationId)
            .collection('leads')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(previousStartDate))
            .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(previousEndDate))
            .get();
        const previousLeads = previousLeadsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        previousFunnel = calculateSalesFunnel(previousLeads);
    }
    return {
        current: currentFunnel,
        previous: previousFunnel,
        period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        },
    };
});
/**
 * Obter analytics de performance de usuários
 */
exports.getUsersPerformanceAnalytics = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para ver performance de usuários');
    }
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Buscar usuários da organização
    let usersQuery = db.collection('organizations')
        .doc(user.organizationId)
        .collection('users')
        .where('status', '==', 'active');
    if (data.userIds && data.userIds.length > 0) {
        usersQuery = usersQuery.where(admin.firestore.FieldPath.documentId(), 'in', data.userIds);
    }
    const usersSnapshot = await usersQuery.get();
    const users = usersSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Calcular performance de cada usuário
    const usersPerformance = await Promise.all(users.map(async (u) => {
        const performance = await calculateUserPerformance(user.organizationId, u.id, startDate, endDate);
        return Object.assign({ user: {
                id: u.id,
                name: u.displayName,
                email: u.email,
                role: u.role,
            } }, performance);
    }));
    return {
        users: usersPerformance,
        period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        },
    };
});
/**
 * Exportar dados de analytics
 */
exports.exportAnalyticsData = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para exportar dados');
    }
    const { startDate, endDate } = calculateDateRange(data.dateRange, data.startDate, data.endDate);
    // Gerar dados para exportação
    const exportData = await generateExportData(user.organizationId, data.type, startDate, endDate, data.filters);
    // Converter para formato solicitado
    const formattedData = await formatExportData(exportData, data.format);
    // Salvar arquivo temporário (em produção, salvaria no Cloud Storage)
    const fileName = `${data.type}_${data.dateRange}_${Date.now()}.${data.format}`;
    return {
        fileName,
        data: formattedData,
        recordCount: exportData.length,
    };
});
// ========== CLOUD FUNCTION AGENDADA PARA AGREGAÇÃO ==========
/**
 * Agregar dados de analytics diariamente
 */
exports.aggregateDailyAnalytics = functions.pubsub
    .schedule('0 2 * * *') // 2 AM diariamente
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
    console.log('Iniciando agregação diária de analytics');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    // Buscar todas as organizações
    const organizationsSnapshot = await db.collection('organizations').get();
    for (const orgDoc of organizationsSnapshot.docs) {
        try {
            const orgId = orgDoc.id;
            console.log(`Agregando dados para organização ${orgId}`);
            const analyticsData = await calculateDailyAnalytics(orgId, yesterday, endOfYesterday);
            // Salvar dados agregados
            await db.collection('organizations')
                .doc(orgId)
                .collection('analytics')
                .doc(yesterday.toISOString().split('T')[0])
                .set(analyticsData);
            console.log(`Dados agregados salvos para ${orgId}`);
        }
        catch (error) {
            console.error(`Erro ao agregar dados para organização ${orgDoc.id}:`, error);
        }
    }
    console.log('Agregação diária concluída');
});
// ========== FUNÇÕES AUXILIARES ==========
function calculateDateRange(range, customStartDate, customEndDate) {
    const endDate = new Date();
    const startDate = new Date();
    switch (range) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case 'custom':
            if (customStartDate)
                startDate.setTime(new Date(customStartDate).getTime());
            if (customEndDate)
                endDate.setTime(new Date(customEndDate).getTime());
            break;
    }
    return { startDate, endDate };
}
async function getAnalyticsData(organizationId, startDate, endDate) {
    // Buscar dados agregados do período
    const analyticsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('analytics')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .orderBy('date', 'asc')
        .get();
    const dailyData = analyticsSnapshot.docs.map(doc => doc.data());
    // Agregar dados do período
    const aggregated = {
        totalLeads: 0,
        newLeads: 0,
        qualifiedLeads: 0,
        convertedLeads: 0,
        lostLeads: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        averageDealSize: 0,
        totalInteractions: 0,
        emailsSent: 0,
        whatsappMessages: 0,
        callsMade: 0,
        leadsBySource: {},
        leadsByStatus: {},
        leadsByUser: {},
        dailyData,
    };
    for (const dayData of dailyData) {
        aggregated.totalLeads += dayData.totalLeads || 0;
        aggregated.newLeads += dayData.newLeads || 0;
        aggregated.qualifiedLeads += dayData.qualifiedLeads || 0;
        aggregated.convertedLeads += dayData.convertedLeads || 0;
        aggregated.lostLeads += dayData.lostLeads || 0;
        aggregated.totalInteractions += dayData.totalInteractions || 0;
        aggregated.emailsSent += dayData.emailsSent || 0;
        aggregated.whatsappMessages += dayData.whatsappMessages || 0;
        aggregated.callsMade += dayData.callsMade || 0;
        // Agregar por fonte
        Object.entries(dayData.leadsBySource || {}).forEach(([source, count]) => {
            aggregated.leadsBySource[source] = (aggregated.leadsBySource[source] || 0) + count;
        });
        // Agregar por status
        Object.entries(dayData.leadsByStatus || {}).forEach(([status, count]) => {
            aggregated.leadsByStatus[status] = (aggregated.leadsByStatus[status] || 0) + count;
        });
        // Agregar por usuário
        Object.entries(dayData.leadsByUser || {}).forEach(([user, count]) => {
            aggregated.leadsByUser[user] = (aggregated.leadsByUser[user] || 0) + count;
        });
    }
    // Calcular médias
    if (dailyData.length > 0) {
        aggregated.conversionRate = dailyData.reduce((sum, day) => sum + (day.conversionRate || 0), 0) / dailyData.length;
        aggregated.averageResponseTime = dailyData.reduce((sum, day) => sum + (day.averageResponseTime || 0), 0) / dailyData.length;
        aggregated.averageDealSize = dailyData.reduce((sum, day) => sum + (day.averageDealSize || 0), 0) / dailyData.length;
    }
    return aggregated;
}
async function getRealtimeAnalytics(organizationId, startDate, endDate) {
    // Para dados em tempo real, buscar diretamente das coleções
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate <= today && endDate >= today) {
        // Incluir dados de hoje em tempo real
        const todayAnalytics = await calculateDailyAnalytics(organizationId, today, new Date());
        return {
            realtime: todayAnalytics,
            lastUpdated: new Date().toISOString(),
        };
    }
    return {};
}
function calculateLeadsMetrics(leads, groupBy, startDate, endDate) {
    const metrics = {
        total: leads.length,
        byStatus: {},
        bySource: {},
        byPeriod: [],
        conversionRate: 0,
        averageScore: 0,
    };
    // Agrupar por status
    leads.forEach(lead => {
        metrics.byStatus[lead.status] = (metrics.byStatus[lead.status] || 0) + 1;
        metrics.bySource[lead.source] = (metrics.bySource[lead.source] || 0) + 1;
    });
    // Calcular taxa de conversão
    const convertedLeads = leads.filter(lead => lead.status === 'won').length;
    metrics.conversionRate = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;
    // Calcular score médio
    const totalScore = leads.reduce((sum, lead) => sum + (lead.score || 0), 0);
    metrics.averageScore = leads.length > 0 ? totalScore / leads.length : 0;
    // Agrupar por período
    const periodGroups = groupLeadsByPeriod(leads, groupBy, startDate, endDate);
    metrics.byPeriod = periodGroups;
    return metrics;
}
function calculateCampaignsMetrics(campaigns) {
    const metrics = {
        total: campaigns.length,
        byType: {},
        byStatus: {},
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        averageOpenRate: 0,
        averageClickRate: 0,
    };
    campaigns.forEach(campaign => {
        metrics.byType[campaign.type] = (metrics.byType[campaign.type] || 0) + 1;
        metrics.byStatus[campaign.status] = (metrics.byStatus[campaign.status] || 0) + 1;
        metrics.totalSent += campaign.metrics.sent || 0;
        metrics.totalDelivered += campaign.metrics.delivered || 0;
        metrics.totalOpened += campaign.metrics.opened || 0;
        metrics.totalClicked += campaign.metrics.clicked || 0;
    });
    // Calcular taxas médias
    if (metrics.totalSent > 0) {
        metrics.averageOpenRate = (metrics.totalOpened / metrics.totalSent) * 100;
        metrics.averageClickRate = (metrics.totalClicked / metrics.totalSent) * 100;
    }
    return metrics;
}
function calculateSalesFunnel(leads) {
    const funnel = {
        new: 0,
        contacted: 0,
        qualified: 0,
        proposal: 0,
        negotiation: 0,
        won: 0,
        lost: 0,
    };
    leads.forEach(lead => {
        if (funnel.hasOwnProperty(lead.status)) {
            funnel[lead.status]++;
        }
    });
    const total = leads.length;
    const conversionRates = {
        contactedRate: total > 0 ? (funnel.contacted / total) * 100 : 0,
        qualifiedRate: funnel.contacted > 0 ? (funnel.qualified / funnel.contacted) * 100 : 0,
        proposalRate: funnel.qualified > 0 ? (funnel.proposal / funnel.qualified) * 100 : 0,
        negotiationRate: funnel.proposal > 0 ? (funnel.negotiation / funnel.proposal) * 100 : 0,
        wonRate: funnel.negotiation > 0 ? (funnel.won / funnel.negotiation) * 100 : 0,
        overallConversionRate: total > 0 ? (funnel.won / total) * 100 : 0,
    };
    return {
        funnel,
        conversionRates,
        total,
    };
}
async function calculateUserPerformance(organizationId, userId, startDate, endDate) {
    // Buscar leads atribuídos ao usuário
    const leadsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('leads')
        .where('assignedTo', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    const leads = leadsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Buscar interações do usuário
    const interactionsSnapshot = await db.collectionGroup('interactions')
        .where('organizationId', '==', organizationId)
        .where('userId', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    const interactions = interactionsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Calcular métricas
    const performance = {
        leadsAssigned: leads.length,
        leadsConverted: leads.filter(lead => lead.status === 'won').length,
        leadsLost: leads.filter(lead => lead.status === 'lost').length,
        totalInteractions: interactions.length,
        interactionsByType: {},
        conversionRate: 0,
        averageResponseTime: 0,
        totalValue: 0,
    };
    // Agrupar interações por tipo
    interactions.forEach(interaction => {
        performance.interactionsByType[interaction.type] =
            (performance.interactionsByType[interaction.type] || 0) + 1;
    });
    // Calcular taxa de conversão
    if (performance.leadsAssigned > 0) {
        performance.conversionRate = (performance.leadsConverted / performance.leadsAssigned) * 100;
    }
    // Calcular valor total
    performance.totalValue = leads
        .filter(lead => lead.status === 'won')
        .reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
    return performance;
}
async function calculateDailyAnalytics(organizationId, startDate, endDate) {
    // Buscar leads do dia
    const leadsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('leads')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    const leads = leadsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Buscar interações do dia
    const interactionsSnapshot = await db.collectionGroup('interactions')
        .where('organizationId', '==', organizationId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    const interactions = interactionsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Calcular métricas
    const analytics = {
        organizationId,
        date: startDate.toISOString().split('T')[0],
        totalLeads: leads.length,
        newLeads: leads.filter(lead => lead.status === 'new').length,
        qualifiedLeads: leads.filter(lead => lead.status === 'qualified').length,
        convertedLeads: leads.filter(lead => lead.status === 'won').length,
        lostLeads: leads.filter(lead => lead.status === 'lost').length,
        funnel: calculateSalesFunnel(leads).funnel,
        leadsBySource: {},
        leadsByUser: {},
        conversionRate: leads.length > 0 ? (leads.filter(lead => lead.status === 'won').length / leads.length) * 100 : 0,
        averageResponseTime: 0,
        averageDealSize: 0,
        totalInteractions: interactions.length,
        emailsSent: interactions.filter(i => i.type === 'email' && i.direction === 'outbound').length,
        whatsappMessages: interactions.filter(i => i.type === 'whatsapp').length,
        callsMade: interactions.filter(i => i.type === 'call' && i.direction === 'outbound').length,
        calculatedAt: admin.firestore.Timestamp.now(),
    };
    // Agrupar leads por fonte
    leads.forEach(lead => {
        analytics.leadsBySource[lead.source] = (analytics.leadsBySource[lead.source] || 0) + 1;
    });
    // Agrupar leads por usuário
    leads.forEach(lead => {
        if (lead.assignedTo) {
            analytics.leadsByUser[lead.assignedTo] = (analytics.leadsByUser[lead.assignedTo] || 0) + 1;
        }
    });
    // Calcular valor médio de deals
    const wonLeads = leads.filter(lead => lead.status === 'won' && lead.estimatedValue);
    if (wonLeads.length > 0) {
        analytics.averageDealSize = wonLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0) / wonLeads.length;
    }
    return analytics;
}
function groupLeadsByPeriod(leads, groupBy, startDate, endDate) {
    const groups = [];
    const current = new Date(startDate);
    while (current <= endDate) {
        const periodStart = new Date(current);
        const periodEnd = new Date(current);
        switch (groupBy) {
            case 'day':
                periodEnd.setDate(periodEnd.getDate() + 1);
                break;
            case 'week':
                periodEnd.setDate(periodEnd.getDate() + 7);
                break;
            case 'month':
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                break;
        }
        const periodLeads = leads.filter(lead => {
            const leadDate = lead.createdAt.toDate();
            return leadDate >= periodStart && leadDate < periodEnd;
        });
        groups.push({
            period: periodStart.toISOString().split('T')[0],
            count: periodLeads.length,
            converted: periodLeads.filter(lead => lead.status === 'won').length,
            lost: periodLeads.filter(lead => lead.status === 'lost').length,
        });
        current.setTime(periodEnd.getTime());
    }
    return groups;
}
async function generateExportData(organizationId, type, startDate, endDate, filters) {
    switch (type) {
        case 'leads':
            return await exportLeadsData(organizationId, startDate, endDate, filters);
        case 'campaigns':
            return await exportCampaignsData(organizationId, startDate, endDate, filters);
        case 'interactions':
            return await exportInteractionsData(organizationId, startDate, endDate, filters);
        default:
            throw new Error('Tipo de exportação não suportado');
    }
}
async function exportLeadsData(organizationId, startDate, endDate, filters) {
    const leadsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('leads')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    return leadsSnapshot.docs.map(doc => {
        const lead = doc.data();
        return {
            id: doc.id,
            nome: lead.name,
            email: lead.email,
            telefone: lead.phone,
            empresa: lead.company,
            cargo: lead.position,
            fonte: lead.source,
            status: lead.status,
            score: lead.score,
            tags: lead.tags.join(', '),
            criado_em: lead.createdAt.toDate().toISOString(),
            atualizado_em: lead.updatedAt.toDate().toISOString(),
        };
    });
}
async function exportCampaignsData(organizationId, startDate, endDate, filters) {
    const campaignsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('campaigns')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    return campaignsSnapshot.docs.map(doc => {
        const campaign = doc.data();
        return {
            id: doc.id,
            nome: campaign.name,
            tipo: campaign.type,
            status: campaign.status,
            enviados: campaign.metrics.sent,
            entregues: campaign.metrics.delivered,
            abertos: campaign.metrics.opened,
            cliques: campaign.metrics.clicked,
            taxa_abertura: campaign.metrics.sent > 0 ? (campaign.metrics.opened / campaign.metrics.sent * 100).toFixed(2) + '%' : '0%',
            taxa_clique: campaign.metrics.sent > 0 ? (campaign.metrics.clicked / campaign.metrics.sent * 100).toFixed(2) + '%' : '0%',
            criado_em: campaign.createdAt.toDate().toISOString(),
        };
    });
}
async function exportInteractionsData(organizationId, startDate, endDate, filters) {
    const interactionsSnapshot = await db.collectionGroup('interactions')
        .where('organizationId', '==', organizationId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .get();
    return interactionsSnapshot.docs.map(doc => {
        const interaction = doc.data();
        return {
            id: doc.id,
            lead_id: interaction.leadId,
            tipo: interaction.type,
            direcao: interaction.direction,
            assunto: interaction.content.subject,
            conteudo: interaction.content.body,
            duracao: interaction.content.duration,
            criado_em: interaction.createdAt.toDate().toISOString(),
        };
    });
}
async function formatExportData(data, format) {
    switch (format) {
        case 'json':
            return JSON.stringify(data, null, 2);
        case 'csv':
            return convertToCSV(data);
        case 'xlsx':
            // Em produção, usaria uma biblioteca como xlsx
            return convertToCSV(data); // Fallback para CSV
        default:
            throw new Error('Formato de exportação não suportado');
    }
}
function convertToCSV(data) {
    if (data.length === 0)
        return '';
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','))
    ].join('\n');
    return csvContent;
}
//# sourceMappingURL=analyticsService.js.map