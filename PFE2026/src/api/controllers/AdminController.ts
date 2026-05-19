

import { JsonController, Get, Authorized, Res, Patch, Param, Body, Delete, Post, QueryParam } from 'routing-controllers';
import { Response } from 'express';
import { Service, Inject } from 'typedi';
import { IListUsersUseCase } from '../../core/usecases/admin/ListUsersUseCase.js';
import { IUpdateUserRoleUseCase } from '../../core/usecases/admin/UpdateUserRoleUseCase.js';
import { ISuspendUserUseCase } from '../../core/usecases/admin/SuspendUserUseCase.js';
import { ICreateProductUseCase } from '../../core/usecases/product/CreateProductUseCase.js';
import { IUpdateProductUseCase } from '../../core/usecases/product/UpdateProductUseCase.js';
import { IDeleteProductUseCase } from '../../core/usecases/product/DeleteProductUseCase.js';
import { IListProductsUseCase } from '../../core/usecases/product/ListProductsUseCase.js';
import { GetChatHealthUseCase } from '../../core/usecases/admin/GetChatHealthUseCase.js';
import { GetUserActivityAnalyticsUseCase } from '../../core/usecases/admin/GetUserActivityAnalyticsUseCase.js';
import { GetUserGraphUseCase } from '../../core/usecases/admin/GetUserGraphUseCase.js';
import { UserRole } from '../../core/types/UserRole.js';
import { CreateProductDto } from '../dtos/product/CreateProductDto.js';
import { db } from '../../infrastructure/db/index.js';
import { conversationLogs } from '../../infrastructure/db/schema/conversationLogs.js';
import { eq, desc, sql, gte, lte, and } from 'drizzle-orm';
import { userSignals } from '../../infrastructure/db/schema/userSignals.js';
import { orders } from '../../infrastructure/db/schema/orders.js';

class UpdateRoleDto {
  role!: UserRole;
}

const SUSPICIOUS_PATTERNS = [
  /<script/i, /javascript:/i, /onerror/i, /onload/i,
  /SELECT.*FROM/i, /UNION/i, /DROP/i, /--/i,
  /\.\.\/\.\./i, /etc\/passwd/i,
];

function isSuspicious(msg: string): boolean {
  return SUSPICIOUS_PATTERNS.some(p => p.test(msg));
}

@JsonController('/admin')
@Service()
export class AdminController {
  @Inject('IListUsersUseCase')
  private listUsersUseCase!: IListUsersUseCase;

  @Inject('IUpdateUserRoleUseCase')
  private updateUserRoleUseCase!: IUpdateUserRoleUseCase;

  @Inject('ISuspendUserUseCase')
  private suspendUserUseCase!: ISuspendUserUseCase;

  @Inject('IListProductsUseCase')
  private listProductsUseCase!: IListProductsUseCase;

  @Inject('ICreateProductUseCase')
  private createProductUseCase!: ICreateProductUseCase;

  @Inject('IUpdateProductUseCase')
  private updateProductUseCase!: IUpdateProductUseCase;

  @Inject('IDeleteProductUseCase')
  private deleteProductUseCase!: IDeleteProductUseCase;

  @Inject('IGetChatHealthUseCase')
  private getChatHealthUseCase!: GetChatHealthUseCase;

  @Inject('IGetUserActivityAnalyticsUseCase')
  private getAnalyticsUseCase!: GetUserActivityAnalyticsUseCase;

  @Inject('IGetUserGraphUseCase')
  private getUserGraphUseCase!: GetUserGraphUseCase;

  // -- Basic ------------------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/ping')
  async ping(@Res() res: Response) {
    return res.json({ success: true, message: 'Admin access granted' });
  }

  // -- Users ------------------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/users')
  async getUsers(@Res() res: Response) {
    const users = await this.listUsersUseCase.execute();
    return res.json({ success: true, data: users });
  }

  @Authorized(['super_admin'])
  @Patch('/users/:userId/role')
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() body: UpdateRoleDto,
    @Res() res: Response,
  ) {
    const success = await this.updateUserRoleUseCase.execute(userId, body.role);
    return res.json({ success });
  }

  @Authorized(['super_admin'])
  @Delete('/users/:userId')
  async suspendUser(@Param('userId') userId: string, @Res() res: Response) {
    const success = await this.suspendUserUseCase.execute(userId);
    return res.json({ success });
  }

  // -- Products ---------------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/products')
  async getProducts(@Res() res: Response) {
    const result = await this.listProductsUseCase.execute({});
    return res.json(result);
  }

  @Authorized(['admin', 'super_admin'])
  @Post('/products')
  async createProduct(@Body() dto: CreateProductDto, @Res() res: Response) {
    const result = await this.createProductUseCase.execute(dto);
    return res.json(result);
  }

  @Authorized(['admin', 'super_admin'])
  @Patch('/products/:productId')
  async updateProduct(
    @Param('productId') productId: string,
    @Body() dto: any,
    @Res() res: Response,
  ) {
    const result = await this.updateProductUseCase.execute({ id: productId, ...dto });
    return res.json(result);
  }

  @Authorized(['super_admin'])
  @Delete('/products/:productId')
  async deleteProduct(@Param('productId') productId: string, @Res() res: Response) {
    const result = await this.deleteProductUseCase.execute(productId);
    return res.json(result);
  }

  // -- Chat health (live metrics) ---------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/chat/health')
  async getChatHealth(@QueryParam('days') days: number = 30, @Res() res: Response) {
    const metrics = await this.getChatHealthUseCase.execute(days);
    return res.json({ success: true, data: metrics });
  }

  @Authorized(['admin', 'super_admin'])
  @Get('/chat/health/stream')
  async streamChatHealth(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const interval = setInterval(async () => {
      try { send(await this.getChatHealthUseCase.execute()); }
      catch { send({ error: 'Failed to fetch health data' }); }
    }, 5000);
    res.on('close', () => clearInterval(interval));
  }

  // -- RAG service health proxy -----------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/rag/health')
  async getRagHealth(@Res() res: Response) {
    try {
      const ragUrl = (process.env.RAG_URL || 'http://localhost:8001').replace(/\/$/, '');
      const r = await fetch(`${ragUrl}/health`);
      const data = await r.json();
      return res.json({ success: true, data });
    } catch {
      return res.json({
        success: true,
        data: { status: 'unavailable', vectors: 0, ml_classifier: 'unavailable' },
      });
    }
  }

  // -- Analytics --------------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/analytics/activity')
  async getActivityAnalytics(
    @Res() res: Response,
    @QueryParam('period') period: string = 'week',
  ) {
    const data = await this.getAnalyticsUseCase.execute(period as any);
    return res.json({ success: true, data });
  }

  @Authorized(['admin', 'super_admin'])
  @Get('/analytics/activity/stream')
  async streamActivity(
    @Res() res: Response,
    @QueryParam('period') period: string = 'week',
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const interval = setInterval(async () => {
      try { send(await this.getAnalyticsUseCase.execute(period as any)); }
      catch { send({ error: 'Failed to fetch analytics' }); }
    }, 10000);
    res.on('close', () => clearInterval(interval));
  }

  @Authorized(['admin', 'super_admin'])
  @Get('/graph/users')
  async getUserGraph(@Res() res: Response) {
    const graph = await this.getUserGraphUseCase.execute();
    return res.json({ success: true, data: graph });
  }

  // -- Analytics: KPI overview ------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/analytics/overview')
  async getAnalyticsOverview(@Res() res: Response) {
    const [usersResult, ordersResult, activeResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM "user"`),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                    AS total_orders,
          COALESCE(SUM(total_amount::numeric), 0)::float   AS total_revenue
        FROM orders
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int AS active_users
        FROM (
          SELECT user_id FROM user_signals
          WHERE created_at >= NOW() - INTERVAL '7 days' AND user_id IS NOT NULL
          UNION
          SELECT user_id FROM conversation_logs
          WHERE created_at >= NOW() - INTERVAL '7 days' AND user_id IS NOT NULL
        ) t
      `),
    ]);
    return res.json({
      success: true,
      data: {
        totalUsers:    (usersResult.rows[0]  as any).count,
        totalOrders:   (ordersResult.rows[0] as any).total_orders,
        totalRevenue:  (ordersResult.rows[0] as any).total_revenue,
        activeUsers7d: (activeResult.rows[0] as any).active_users,
      },
    });
  }

  // -- Analytics: per-user signal summary ------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/analytics/users/summary')
  async getUsersActivitySummary(@Res() res: Response) {
    const result = await db.execute(sql`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(CASE WHEN s.type = 'view'     THEN 1 END)::int  AS views,
        COUNT(CASE WHEN s.type = 'search'   THEN 1 END)::int  AS searches,
        COUNT(CASE WHEN s.type = 'cart'     THEN 1 END)::int  AS carts,
        COUNT(CASE WHEN s.type = 'wishlist' THEN 1 END)::int  AS wishlists,
        COUNT(s.id)::int                                        AS total,
        MAX(s.created_at)                                       AS last_active
      FROM "user" u
      LEFT JOIN user_signals s ON s.user_id = u.id
      GROUP BY u.id, u.name, u.email
      ORDER BY total DESC
      LIMIT 100
    `);
    return res.json({ success: true, data: result.rows });
  }

  // -- Analytics: signals breakdown (chatbot vs UI) ---------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/analytics/signals/breakdown')
  async getSignalsBreakdown(
    @Res() res: Response,
    @QueryParam('days') days: number = 7,
  ) {
    const breakdown = await db.execute(sql`
      SELECT
        type,
        COUNT(*)::int                  AS count,
        COUNT(DISTINCT user_id)::int   AS unique_users
      FROM user_signals
      WHERE created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY type
      ORDER BY count DESC
    `);

    const trend = await db.execute(sql`
      SELECT
        DATE(created_at)::text  AS date,
        type,
        COUNT(*)::int           AS count
      FROM user_signals
      WHERE created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(created_at), type
      ORDER BY date ASC
    `);

    return res.json({
      success: true,
      data: {
        breakdown: breakdown.rows,
        trend:     trend.rows,
      },
    });
  }

  // -- Chat: aggregated user list ---------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/chat/users')
  async getChatUsers(
    @Res() res: Response,
    @QueryParam('days') days: number = 30,
  ) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        cl.user_id,
        cl.session_id,
        u.name                                                   AS user_name,
        u.email                                                  AS user_email,
        COUNT(*)::int                                            AS message_count,
        MAX(cl.created_at)                                       AS last_active,
        COUNT(CASE WHEN
          cl.user_message ~* '<script|javascript:|onerror|onload|SELECT .{1,30} FROM|UNION |DROP |\.\.\/|etc/passwd'
          THEN 1 END)::int                                       AS suspicious_count
      FROM conversation_logs cl
      LEFT JOIN "user" u ON u.id = cl.user_id
      WHERE cl.created_at >= ${since}
      GROUP BY cl.user_id, cl.session_id, u.name, u.email
      ORDER BY last_active DESC
      LIMIT 200
    `);

    const rows = result.rows as Array<{
      user_id:          string | null;
      session_id:       string;
      user_name:        string | null;
      user_email:       string | null;
      message_count:    number;
      last_active:      string;
      suspicious_count: number;
    }>;

    const data = rows.map((r) => ({
      userId:        r.user_id ?? null,
      sessionId:     r.session_id,
      userName:      r.user_name ?? null,
      userEmail:     r.user_email ?? null,
      messageCount:  r.message_count,
      lastActive:    r.last_active,
      hasSuspicious: r.suspicious_count > 0,
      identifier:    r.user_name ?? r.user_email ?? r.user_id ?? `anon:${String(r.session_id).slice(-10)}`,
      isAnon:        !r.user_id,
    }));

    return res.json({ success: true, data });
  }

  // -- Chat: messages ---------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/chat/messages')
  async getChatMessages(
    @Res() res: Response,
    @QueryParam('userId')         userId?: string,
    @QueryParam('sessionId')      sessionId?: string,
    @QueryParam('suspiciousOnly') suspiciousOnly?: boolean,
    @QueryParam('limit')          limit: number = 100,
  ) {
    const condition = userId
      ? eq(conversationLogs.userId, userId)
      : sessionId
      ? eq(conversationLogs.sessionId, sessionId)
      : undefined;

    const logs = await db
      .select()
      .from(conversationLogs)
      .where(condition)
      .orderBy(desc(conversationLogs.createdAt))
      .limit(limit);

    const enriched = logs.map(log => ({
      ...log,
      botMessages: log.botMessages as Array<{ text: string; confidence?: number }>,
      suspicious:  isSuspicious(log.userMessage),
      createdAt:   log.createdAt.toISOString(),
    }));

    const result = suspiciousOnly ? enriched.filter(l => l.suspicious) : enriched;
    return res.json({ success: true, data: result });
  }

  // -- Chat: quality / hallucination tracker ----------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/chat/quality')
  async getChatQuality(
    @Res() res: Response,
    @QueryParam('days') days: number = 30,
  ) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        COALESCE(intent, 'unknown')   AS intent,
        COUNT(*)::int                 AS count,
        MIN(created_at)               AS first_seen,
        MAX(created_at)               AS last_seen
      FROM conversation_logs
      WHERE created_at >= ${since}
      GROUP BY intent
      ORDER BY count DESC
    `);

    const offTopicLogs = await db
      .select()
      .from(conversationLogs)
      .where(eq(conversationLogs.intent, 'off_topic'))
      .orderBy(desc(conversationLogs.createdAt))
      .limit(100);

    const noRagLogs = await db
      .select()
      .from(conversationLogs)
      .where(eq(conversationLogs.intent, 'no_rag_context'))
      .orderBy(desc(conversationLogs.createdAt))
      .limit(50);

    // Language breakdown from recent logs
    const recentForLang = await db
      .select({ msg: conversationLogs.userMessage })
      .from(conversationLogs)
      .where(gte(conversationLogs.createdAt, since))
      .limit(300);

    const langBreakdown = { arabic: 0, french: 0, english: 0, other: 0 };
    for (const { msg } of recentForLang) {
      if (/[\u0600-\u06FF]/.test(msg))
        langBreakdown.arabic++;
      else if (/[àâäéèêëîïôùûü]|bonjour|merci|s[ée]rum|peau|cheveux|produit|cr[eè]me|huile|masque|tonik|visage|solaire|hydrat|soin|beaut|recommand|pour les|je veux|avez.vous|qu[ea]|votre|notre|avec/i.test(msg))
        langBreakdown.french++;
      else if (/[a-zA-Z]/.test(msg))
        langBreakdown.english++;
      else
        langBreakdown.other++;
    }

    const ORDER_RE = /order|track|shipping|deliver|ORD-|where.*my|status.*order/i;
    const toSample = (l: any) => ({
      id:        l.id,
      message:   l.userMessage,
      userId:    l.userId,
      createdAt: l.createdAt,
    });

    return res.json({
      success: true,
      data: {
        summary:        result.rows,
        offTopicSample: offTopicLogs.filter(l => !ORDER_RE.test(l.userMessage)).map(toSample),
        noRagSample:    noRagLogs.map(toSample),
        orderGapSample: offTopicLogs.filter(l =>  ORDER_RE.test(l.userMessage)).map(toSample),
        langBreakdown,
      },
    });
  }

  // -- User activity signals --------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/users/:userId/activity')
  async getUserActivity(@Param('userId') userId: string, @Res() res: Response) {
    const signals = await db
      .select()
      .from(userSignals)
      .where(eq(userSignals.userId, userId))
      .orderBy(desc(userSignals.createdAt))
      .limit(200);

    const summary = {
      views:         signals.filter(s => s.type === 'view').length,
      searches:      signals.filter(s => s.type === 'search').length,
      carts:         signals.filter(s => s.type === 'cart').length,
      wishlists:     signals.filter(s => s.type === 'wishlist').length,
      recentSignals: signals.slice(0, 50),
    };
    return res.json({ success: true, data: summary });
  }

  // -- User chat (by userId) � backward compat --------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/users/:userId/chat')
  async getUserChatMessages(@Param('userId') userId: string, @Res() res: Response) {
    const logs = await db
      .select()
      .from(conversationLogs)
      .where(eq(conversationLogs.userId, userId))
      .orderBy(desc(conversationLogs.createdAt))
      .limit(100);

    const enriched = logs.map(log => ({
      ...log,
      botMessages: log.botMessages as Array<{ text: string; confidence?: number }>,
      suspicious:  isSuspicious(log.userMessage),
      createdAt:   log.createdAt.toISOString(),
    }));

    return res.json({ success: true, data: enriched });
  }

  // -- Orders -----------------------------------------------------------------

  @Authorized(['admin', 'super_admin'])
  @Get('/orders')
  async getOrders(
    @Res() res: Response,
    @QueryParam('userId')   userId?: string,
    @QueryParam('dateFrom') dateFrom?: string,
    @QueryParam('dateTo')   dateTo?: string,
  ) {
    const conditions = [];
    if (userId)   conditions.push(eq(orders.userId, userId));
    if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.createdAt, end));
    }

    const rows = await db
      .select({
        id:              orders.id,
        userId:          orders.userId,
        totalAmount:     orders.totalAmount,
        status:          orders.status,
        items:           orders.items,
        shippingAddress: orders.shippingAddress,
        paymentMethod:   orders.paymentMethod,
        trackingNumber:  orders.trackingNumber,
        createdAt:       orders.createdAt,
        updatedAt:       orders.updatedAt,
      })
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(500);

    const userIds = [...new Set(rows.map(r => r.userId))];
    const userRows = userIds.length
      ? await db.execute(
          sql.raw(
            'SELECT id, name, email FROM "user" WHERE id = ANY(ARRAY[' +
              userIds.map(id => "'" + id.replace(/'/g, "''") + "'").join(',') +
            '])',
          ),
        )
      : { rows: [] };

    const userMap: Record<string, { name: string | null; email: string | null }> = {};
    for (const u of userRows.rows as any[]) userMap[u.id] = { name: u.name, email: u.email };

    const data = rows.map(r => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      userName:    userMap[r.userId]?.name  ?? null,
      userEmail:   userMap[r.userId]?.email ?? null,
      createdAt:   r.createdAt.toISOString(),
      updatedAt:   r.updatedAt.toISOString(),
    }));

    return res.json({ success: true, data });
  }

  @Authorized(['admin', 'super_admin'])
  @Patch('/orders/:orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: string },
    @Res() res: Response,
  ) {
    const VALID = ['PENDING', 'CONFIRMED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
    if (!VALID.includes(body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db
      .update(orders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return res.json({ success: true });
  }
}
