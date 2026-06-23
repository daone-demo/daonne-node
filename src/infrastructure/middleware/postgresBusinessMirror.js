import { store } from "../db/memoryStore.js";

export async function mirrorPostgresBusinessTables(pool) {
  const client = await pool.connect();
  try {
    await mirrorStep(client, "users", mirrorUsers);
    await mirrorStep(client, "plans", mirrorPlans);
    await mirrorStep(client, "models", mirrorModels);
    await mirrorStep(client, "inspirations", mirrorInspirations);
    await mirrorStep(client, "projects", mirrorProjects);
    await mirrorStep(client, "assets", mirrorAssets);
    await mirrorStep(client, "ai", mirrorAi);
    await mirrorStep(client, "chat", mirrorChat);
    await mirrorStep(client, "workflows", mirrorWorkflows);
    await mirrorStep(client, "billing", mirrorBilling);
    await mirrorStep(client, "adminContent", mirrorAdminContent);
  } finally {
    client.release();
  }
}

async function mirrorStep(client, name, mirror) {
  try {
    await client.query("BEGIN");
    await mirror(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.warn(`Postgres business table mirror failed at ${name}:`, error.message);
  }
}

async function mirrorUsers(client) {
  for (const user of store.users.values()) {
    await client.query(
      `INSERT INTO user_account (id, phone, wechat_open_id, nickname, avatar_url, email, gender, birthday, status, role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         phone = EXCLUDED.phone,
         wechat_open_id = EXCLUDED.wechat_open_id,
         nickname = EXCLUDED.nickname,
         avatar_url = EXCLUDED.avatar_url,
         email = EXCLUDED.email,
         gender = EXCLUDED.gender,
         birthday = EXCLUDED.birthday,
         status = EXCLUDED.status,
         role = EXCLUDED.role,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(user.id),
        nullable(user.phone),
        nullable(user.wechatOpenId),
        user.nickname || `Daone${String(user.phone || user.id).slice(-4)}`,
        nullable(user.avatarUrl),
        nullable(user.email),
        user.gender || "UNKNOWN",
        nullable(user.birthday),
        user.status || "ENABLED",
        user.role || "USER",
        timestamp(user.createdAt),
        timestamp(user.updatedAt || user.createdAt)
      ]
    );
  }

  for (const account of store.pointAccounts.values()) {
    await client.query(
      `INSERT INTO point_account (user_id, available_points, frozen_points, granted_total, version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE SET
         available_points = EXCLUDED.available_points,
         frozen_points = EXCLUDED.frozen_points,
         granted_total = EXCLUDED.granted_total,
         version = EXCLUDED.version,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(account.userId),
        number(account.availablePoints),
        number(account.frozenPoints),
        number(account.grantedTotal),
        number(account.version),
        timestamp(account.updatedAt)
      ]
    );
  }

  for (const ledger of store.pointLedgers.values()) {
    await client.query(
      `INSERT INTO point_ledger (id, user_id, action, amount, balance_after, biz_type, biz_id, description, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         amount = EXCLUDED.amount,
         balance_after = EXCLUDED.balance_after,
         description = EXCLUDED.description`,
      [
        toBigInt(ledger.id),
        toBigInt(ledger.userId),
        ledger.action,
        number(ledger.amount),
        number(ledger.balanceAfter),
        ledger.bizType,
        String(ledger.bizId),
        nullable(ledger.description),
        timestamp(ledger.createdAt)
      ]
    );
  }
}

async function mirrorPlans(client) {
  for (const plan of store.plans.values()) {
    await client.query(
      `INSERT INTO subscription_plan (id, plan_code, plan_name, description, benefits_json, status, created_at, updated_at, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         plan_code = EXCLUDED.plan_code,
         plan_name = EXCLUDED.plan_name,
         description = EXCLUDED.description,
         benefits_json = EXCLUDED.benefits_json,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(plan.id),
        plan.planCode,
        plan.planName,
        nullable(plan.description),
        json(plan.benefits || []),
        plan.status || "ENABLED",
        timestamp(plan.createdAt),
        timestamp(plan.updatedAt || plan.createdAt),
        boolean(plan.deleted),
        json(plan.attributes || {})
      ]
    );
  }

  for (const price of store.prices.values()) {
    await client.query(
      `INSERT INTO subscription_plan_price (id, plan_id, price_code, cycle_unit, cycle_count, price_fen, original_price_fen, grant_points, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         price_code = EXCLUDED.price_code,
         cycle_unit = EXCLUDED.cycle_unit,
         cycle_count = EXCLUDED.cycle_count,
         price_fen = EXCLUDED.price_fen,
         original_price_fen = EXCLUDED.original_price_fen,
         grant_points = EXCLUDED.grant_points,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(price.id),
        toBigInt(price.planId),
        price.priceCode,
        price.cycleUnit,
        number(price.cycleCount),
        number(price.priceFen),
        nullableNumber(price.originalPriceFen),
        number(price.grantPoints),
        price.status || "ENABLED",
        timestamp(price.createdAt),
        timestamp(price.updatedAt || price.createdAt)
      ]
    );
  }
}

async function mirrorModels(client) {
  for (const model of store.models.values()) {
    await client.query(
      `INSERT INTO model_config (id, model_code, model_name, task_type, base_points, parameters_json, status, created_at, updated_at, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         model_code = EXCLUDED.model_code,
         model_name = EXCLUDED.model_name,
         task_type = EXCLUDED.task_type,
         base_points = EXCLUDED.base_points,
         parameters_json = EXCLUDED.parameters_json,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(model.id),
        model.modelCode,
        model.modelName,
        model.taskType,
        number(model.basePoints),
        json(model.parameters || {}),
        model.status || "ENABLED",
        timestamp(model.createdAt),
        timestamp(model.updatedAt || model.createdAt),
        boolean(model.deleted),
        json(model.attributes || {})
      ]
    );
  }
}

async function mirrorInspirations(client) {
  for (const item of store.inspirations.values()) {
    await client.query(
      `INSERT INTO inspiration (id, title, cover_url, category_code, author_name, author_avatar_url, like_count, view_count, sort_no, status, created_at, updated_at, prompt, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         cover_url = EXCLUDED.cover_url,
         category_code = EXCLUDED.category_code,
         author_name = EXCLUDED.author_name,
         author_avatar_url = EXCLUDED.author_avatar_url,
         like_count = EXCLUDED.like_count,
         view_count = EXCLUDED.view_count,
         sort_no = EXCLUDED.sort_no,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         prompt = EXCLUDED.prompt,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(item.id),
        item.title,
        item.coverUrl,
        item.categoryCode,
        item.authorName || "Daone",
        nullable(item.authorAvatarUrl),
        number(item.likeCount),
        number(item.viewCount),
        number(item.sortNo),
        item.status || "ENABLED",
        timestamp(item.createdAt),
        timestamp(item.updatedAt || item.createdAt),
        nullable(item.prompt),
        boolean(item.deleted),
        json(item.attributes || {})
      ]
    );
  }
}

async function mirrorProjects(client) {
  for (const project of store.projects.values()) {
    await client.query(
      `INSERT INTO project (id, user_id, title, cover_asset_id, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         cover_asset_id = EXCLUDED.cover_asset_id,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(project.id),
        toBigInt(project.userId),
        project.title,
        nullableBigInt(project.coverAssetId),
        project.status || "ACTIVE",
        timestamp(project.createdAt),
        timestamp(project.updatedAt || project.createdAt)
      ]
    );
  }

  for (const canvas of store.canvases.values()) {
    await client.query(
      `INSERT INTO project_canvas (project_id, canvas_json, revision, updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (project_id) DO UPDATE SET
         canvas_json = EXCLUDED.canvas_json,
         revision = EXCLUDED.revision,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(canvas.projectId),
        json(canvas.canvas || {}),
        number(canvas.revision),
        timestamp(canvas.updatedAt)
      ]
    );
  }

  for (const version of store.versions.values()) {
    await client.query(
      `INSERT INTO project_version (id, project_id, version_no, canvas_json, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         canvas_json = EXCLUDED.canvas_json`,
      [
        toBigInt(version.id),
        toBigInt(version.projectId),
        number(version.versionNo),
        json(version.canvas || {}),
        timestamp(version.createdAt)
      ]
    );
  }

  for (const share of store.shares.values()) {
    await client.query(
      `INSERT INTO project_share (id, share_code, project_id, user_id, status, expire_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         expire_at = EXCLUDED.expire_at`,
      [
        shareId(share.shareCode),
        share.shareCode,
        toBigInt(share.projectId),
        toBigInt(share.userId),
        share.status || "ACTIVE",
        timestamp(share.expireAt || "2999-12-31T00:00:00.000Z"),
        timestamp(share.createdAt)
      ]
    );
  }
}

async function mirrorAssets(client) {
  for (const asset of store.assets.values()) {
    await client.query(
      `INSERT INTO asset (id, user_id, project_id, type, source, file_name, object_key, content_type, file_size, width, height, duration_seconds, review_status, deleted, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         file_name = EXCLUDED.file_name,
         object_key = EXCLUDED.object_key,
         content_type = EXCLUDED.content_type,
         file_size = EXCLUDED.file_size,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         duration_seconds = EXCLUDED.duration_seconds,
         review_status = EXCLUDED.review_status,
         deleted = EXCLUDED.deleted,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(asset.id),
        nullableBigInt(asset.userId) || 0,
        nullableBigInt(asset.projectId),
        asset.type,
        asset.source,
        asset.fileName,
        nullable(asset.objectKey),
        nullable(asset.contentType),
        nullableNumber(asset.fileSize),
        nullableNumber(asset.width),
        nullableNumber(asset.height),
        nullableNumber(asset.durationSeconds),
        asset.reviewStatus || "AVAILABLE",
        asset.reviewStatus === "DELETED" ? 1 : 0,
        timestamp(asset.createdAt),
        timestamp(asset.updatedAt || asset.createdAt)
      ]
    );
  }

  let favoriteId = 1;
  for (const value of store.favorites.values()) {
    const [userId, assetId] = String(value).split(":");
    await client.query(
      `INSERT INTO asset_favorite (id, user_id, asset_id, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, asset_id) DO NOTHING`,
      [favoriteId++, toBigInt(userId), toBigInt(assetId), timestamp()]
    );
  }
}

async function mirrorAi(client) {
  for (const task of store.generationTasks.values()) {
    await client.query(
      `INSERT INTO generation_task (id, user_id, project_id, node_id, task_type, capability_code, prompt, parameters_json, reference_asset_ids_json, idempotency_key, provider_task_id, status, progress, estimated_points, actual_points, error_code, error_message, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         progress = EXCLUDED.progress,
         actual_points = EXCLUDED.actual_points,
         error_code = EXCLUDED.error_code,
         error_message = EXCLUDED.error_message,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(task.id),
        toBigInt(task.userId),
        nullableBigInt(task.projectId),
        nullable(task.nodeId),
        task.taskType,
        task.capabilityCode,
        nullable(task.prompt),
        json(task.parameters || {}),
        json(task.referenceAssetIds || []),
        task.idempotencyKey,
        nullable(task.providerTaskId),
        task.status,
        number(task.progress),
        number(task.estimatedPoints),
        nullableNumber(task.actualPoints),
        nullable(task.error?.code),
        nullable(task.error?.message),
        timestamp(task.createdAt),
        timestamp(task.updatedAt || task.createdAt)
      ]
    );

    for (const [index, result] of (task.results || []).entries()) {
      if (!result.assetId) continue;
      await client.query(
        `INSERT INTO generation_result (id, task_id, asset_id, sort_no, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET sort_no = EXCLUDED.sort_no`,
        [resultId(task.id, result.assetId), toBigInt(task.id), toBigInt(result.assetId), index, timestamp(task.updatedAt || task.createdAt)]
      );
    }
  }
}

async function mirrorChat(client) {
  for (const session of store.chatSessions.values()) {
    await client.query(
      `INSERT INTO chat_session (id, user_id, project_id, title, deleted, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         deleted = EXCLUDED.deleted,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(session.id),
        toBigInt(session.userId),
        nullableBigInt(session.projectId) || 0,
        session.title,
        session.deleted ? 1 : 0,
        timestamp(session.createdAt),
        timestamp(session.updatedAt || session.createdAt)
      ]
    );
  }

  for (const message of store.chatMessages.values()) {
    await client.query(
      `INSERT INTO chat_message (id, session_id, role, content, attachment_asset_ids_json, generation_task_ids_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`,
      [
        toBigInt(message.id),
        toBigInt(message.sessionId),
        message.role,
        message.content,
        json(message.attachmentAssetIds || []),
        json(message.generationTaskIds || []),
        timestamp(message.createdAt)
      ]
    );
  }
}

async function mirrorWorkflows(client) {
  for (const workflow of store.workflows.values()) {
    await client.query(
      `INSERT INTO workflow (id, user_id, name, description, cover_asset_id, workflow_json, deleted, created_at, updated_at, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         cover_asset_id = EXCLUDED.cover_asset_id,
         workflow_json = EXCLUDED.workflow_json,
         deleted = EXCLUDED.deleted,
         updated_at = EXCLUDED.updated_at,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(workflow.id),
        nullableBigInt(workflow.userId) || 0,
        workflow.name,
        nullable(workflow.description),
        nullableBigInt(workflow.coverAssetId),
        json(workflow.workflowData || {}),
        workflow.deleted ? 1 : 0,
        timestamp(workflow.createdAt),
        timestamp(workflow.updatedAt || workflow.createdAt),
        json(workflow.attributes || {})
      ]
    );
  }
}

async function mirrorBilling(client) {
  for (const order of store.orders.values()) {
    await client.query(
      `INSERT INTO payment_order (id, order_no, user_id, order_type, product_code, product_name, product_snapshot_json, amount_fen, currency, status, expire_at, paid_at, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         paid_at = EXCLUDED.paid_at,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(order.id),
        order.orderNo,
        toBigInt(order.userId),
        order.orderType,
        order.productCode,
        order.productName,
        json(order.productSnapshot || {}),
        number(order.amountFen),
        order.currency || "CNY",
        order.status,
        timestamp(order.expireAt),
        nullableTimestamp(order.paidAt),
        order.idempotencyKey,
        timestamp(order.createdAt),
        timestamp(order.updatedAt || order.createdAt)
      ]
    );
  }

  for (const transaction of store.transactions.values()) {
    await client.query(
      `INSERT INTO payment_transaction (id, transaction_no, order_no, pay_type, channel_transaction_no, status, pay_payload, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         channel_transaction_no = EXCLUDED.channel_transaction_no,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        toBigInt(transaction.id),
        transaction.transactionNo,
        transaction.orderNo,
        transaction.payType,
        nullable(transaction.channelTransactionNo),
        transaction.status,
        json({
          qrCodeContent: transaction.qrCodeContent,
          redirectUrl: transaction.redirectUrl
        }),
        timestamp(transaction.createdAt),
        timestamp(transaction.updatedAt || transaction.createdAt)
      ]
    );
  }

  let subscriptionId = 1;
  for (const [userId, subscription] of store.subscriptions.entries()) {
    const plan = [...store.plans.values()].find((item) => item.planCode === subscription.planCode);
    await client.query(
      `INSERT INTO user_subscription (id, user_id, plan_id, price_code, status, current_period_start, current_period_end, auto_renew, latest_order_no, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         price_code = EXCLUDED.price_code,
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end,
         auto_renew = EXCLUDED.auto_renew,
         latest_order_no = EXCLUDED.latest_order_no,
         updated_at = EXCLUDED.updated_at`,
      [
        subscriptionId++,
        toBigInt(userId),
        toBigInt(plan?.id || 0),
        subscription.priceCode || "",
        subscription.status || "ACTIVE",
        timestamp(subscription.currentPeriodStart || subscription.createdAt),
        timestamp(subscription.expireAt || subscription.currentPeriodEnd),
        subscription.autoRenew ? 1 : 0,
        nullable(subscription.latestOrderNo),
        number(subscription.version),
        timestamp(subscription.createdAt),
        timestamp(subscription.updatedAt || subscription.createdAt)
      ]
    );
  }
}

async function mirrorAdminContent(client) {
  for (const template of store.promptTemplates.values()) {
    await client.query(
      `INSERT INTO prompt_template (id, template_code, template_name, scene, content, status, created_at, updated_at, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         template_name = EXCLUDED.template_name,
         scene = EXCLUDED.scene,
         content = EXCLUDED.content,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(template.id),
        template.code,
        template.name,
        template.scenario || template.scene || "GENERAL",
        template.content,
        template.status || "ENABLED",
        timestamp(template.createdAt),
        timestamp(template.updatedAt || template.createdAt),
        boolean(template.deleted),
        json(template.attributes || {})
      ]
    );
  }

  for (const category of store.contentCategories.values()) {
    await client.query(
      `INSERT INTO content_category (id, category_code, category_name, scope, parent_code, sort_no, status, gmt_create, gmt_modified, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         category_code = EXCLUDED.category_code,
         category_name = EXCLUDED.category_name,
         scope = EXCLUDED.scope,
         parent_code = EXCLUDED.parent_code,
         sort_no = EXCLUDED.sort_no,
         status = EXCLUDED.status,
         gmt_modified = EXCLUDED.gmt_modified,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(category.id),
        category.categoryCode,
        category.categoryName,
        category.scope || "ALL",
        nullable(category.parentCode),
        number(category.sortNo),
        category.status || "ENABLED",
        timestamp(category.createdAt),
        timestamp(category.updatedAt || category.createdAt),
        boolean(category.deleted),
        json(category.attributes || {})
      ]
    );
  }

  for (const invoice of store.invoiceApplications.values()) {
    await client.query(
      `INSERT INTO invoice_application (id, invoice_no, user_id, order_no, invoice_title, tax_no, invoice_type, amount_fen, status, email, receiver_name, receiver_phone, receiver_address, reject_reason, issued_at, invoice_file_asset_id, express_company, express_no, gmt_create, gmt_modified, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO UPDATE SET
         invoice_no = EXCLUDED.invoice_no,
         user_id = EXCLUDED.user_id,
         order_no = EXCLUDED.order_no,
         invoice_title = EXCLUDED.invoice_title,
         tax_no = EXCLUDED.tax_no,
         invoice_type = EXCLUDED.invoice_type,
         amount_fen = EXCLUDED.amount_fen,
         status = EXCLUDED.status,
         email = EXCLUDED.email,
         receiver_name = EXCLUDED.receiver_name,
         receiver_phone = EXCLUDED.receiver_phone,
         receiver_address = EXCLUDED.receiver_address,
         reject_reason = EXCLUDED.reject_reason,
         issued_at = EXCLUDED.issued_at,
         invoice_file_asset_id = EXCLUDED.invoice_file_asset_id,
         express_company = EXCLUDED.express_company,
         express_no = EXCLUDED.express_no,
         gmt_modified = EXCLUDED.gmt_modified,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(invoice.id),
        invoice.invoiceNo,
        toBigInt(invoice.userId),
        invoice.orderNo,
        invoice.invoiceTitle,
        invoice.taxNo,
        invoice.invoiceType || "VAT_NORMAL",
        number(invoice.amountFen),
        invoice.status || "PENDING",
        nullable(invoice.email),
        nullable(invoice.receiverName),
        nullable(invoice.receiverPhone),
        nullable(invoice.receiverAddress),
        nullable(invoice.rejectReason),
        nullableTimestamp(invoice.issuedAt),
        nullableBigInt(invoice.invoiceFileAssetId),
        nullable(invoice.expressCompany),
        nullable(invoice.expressNo),
        timestamp(invoice.createdAt),
        timestamp(invoice.updatedAt || invoice.createdAt),
        boolean(invoice.deleted),
        json(invoice.attributes || {})
      ]
    );
  }

  for (const log of store.adminOperationLogs.values()) {
    await client.query(
      `INSERT INTO admin_operation_log (id, admin_user_id, action, target_type, target_id, before_json, after_json, remark, gmt_create, gmt_modified, deleted, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         action = EXCLUDED.action,
         target_type = EXCLUDED.target_type,
         target_id = EXCLUDED.target_id,
         before_json = EXCLUDED.before_json,
         after_json = EXCLUDED.after_json,
         remark = EXCLUDED.remark,
         gmt_modified = EXCLUDED.gmt_modified,
         deleted = EXCLUDED.deleted,
         attributes = EXCLUDED.attributes`,
      [
        toBigInt(log.id),
        toBigInt(log.adminUserId),
        log.action,
        log.targetType,
        nullable(log.targetId),
        json(log.before),
        json(log.after),
        nullable(log.remark),
        timestamp(log.createdAt),
        timestamp(log.updatedAt || log.createdAt),
        boolean(log.deleted),
        json(log.attributes || {})
      ]
    );
  }
}

function timestamp(value = new Date().toISOString()) {
  return new Date(value);
}

function nullableTimestamp(value) {
  return value ? timestamp(value) : null;
}

function nullable(value) {
  return value === undefined || value === "" ? null : value;
}

function number(value) {
  return Number(value || 0);
}

function nullableNumber(value) {
  return value === undefined || value === null || value === "" ? null : Number(value);
}

function toBigInt(value) {
  const parsed = Number(String(value || 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableBigInt(value) {
  return value === undefined || value === null || value === "" ? null : toBigInt(value);
}

function boolean(value) {
  return Boolean(value);
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function shareId(shareCode) {
  return parseInt(String(shareCode).slice(0, 12), 16);
}

function resultId(taskId, assetId) {
  const value = `${String(taskId).slice(-8)}${String(assetId).slice(-7)}`;
  return Number(value.slice(0, 15));
}
