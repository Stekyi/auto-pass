import {
  pgTable, uuid, varchar, text, boolean, integer, numeric,
  date, timestamp, pgEnum, jsonb, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const staffRoleEnum     = pgEnum("staff_role",     ["ADMIN", "CLERK"]);
export const jobStatusEnum     = pgEnum("job_status",     ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "MOBILE_MONEY", "BANK_TRANSFER"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["ACTIVE", "EXPIRED", "SUSPENDED"]);
export const photoTypeEnum     = pgEnum("photo_type",     ["before", "after", "general", "receipt"]);

// ─── Mechanics (Tenants) ──────────────────────────────────────────────────────

export const mechanics = pgTable("mechanics", {
  id:           uuid("id").defaultRandom().primaryKey(),
  name:         varchar("name", { length: 200 }).notNull(),
  code:         varchar("code", { length: 10 }).notNull().unique(),
  ownerName:    varchar("owner_name", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  contactTel:   varchar("contact_tel", { length: 30 }),
  location:     text("location"),
  lat:          numeric("lat", { precision: 10, scale: 7 }),
  lng:          numeric("lng", { precision: 10, scale: 7 }),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id:           uuid("id").defaultRandom().primaryKey(),
  mechanicId:   uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
  status:       subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  startDate:    date("start_date").notNull(),
  endDate:      date("end_date").notNull(),
  amountGhs:    numeric("amount_ghs", { precision: 10, scale: 2 }).notNull().default("100"),
  paidAt:       timestamp("paid_at"),
  reference:    varchar("reference", { length: 200 }),
  notes:        text("notes"),
  recordedBy:   uuid("recorded_by"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = pgTable("settings", {
  key:       varchar("key", { length: 100 }).primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Staff Users ──────────────────────────────────────────────────────────────

export const staffUsers = pgTable("staff_users", {
  id:           uuid("id").defaultRandom().primaryKey(),
  mechanicId:   uuid("mechanic_id").references(() => mechanics.id, { onDelete: "cascade" }),
  name:         varchar("name", { length: 200 }).notNull(),
  email:        varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role:         staffRoleEnum("role").notNull().default("CLERK"),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id:             uuid("id").defaultRandom().primaryKey(),
    mechanicId:     uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
    customerNumber: varchar("customer_number", { length: 30 }).unique(),
    fullName:       varchar("full_name", { length: 200 }).notNull(),
    tel:            varchar("tel", { length: 30 }).notNull(),
    email:          varchar("email", { length: 200 }),
    location:       text("location"),
    isActive:       boolean("is_active").notNull().default(true),
    createdAt:      timestamp("created_at").defaultNow().notNull(),
    updatedAt:      timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("customers_mechanic_idx").on(t.mechanicId),
    index("customers_tel_idx").on(t.tel),
  ]
);

// ─── Vehicles ─────────────────────────────────────────────────────────────────
// Vehicles are GLOBAL — not tenant-scoped. Any mechanic can add repair jobs.
// mechanicId records who first registered the vehicle (informational only).

export const vehicles = pgTable(
  "vehicles",
  {
    id:               uuid("id").defaultRandom().primaryKey(),
    mechanicId:       uuid("mechanic_id").references(() => mechanics.id, { onDelete: "set null" }),
    customerId:       uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    vehicleNumber:    varchar("vehicle_number", { length: 20 }).notNull().unique(),
    plateNumber:      varchar("plate_number", { length: 30 }),
    vin:              varchar("vin", { length: 17 }),
    make:             varchar("make", { length: 100 }),
    model:            varchar("model", { length: 100 }),
    year:             integer("year"),
    engineSize:       varchar("engine_size", { length: 30 }),
    fuelType:         varchar("fuel_type", { length: 30 }),
    color:            varchar("color", { length: 50 }),
    currentMileageKm: integer("current_mileage_km"),
    notes:            text("notes"),
    isActive:         boolean("is_active").notNull().default(true),
    createdAt:        timestamp("created_at").defaultNow().notNull(),
    updatedAt:        timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("vehicles_mechanic_idx").on(t.mechanicId),
    index("vehicles_customer_idx").on(t.customerId),
    index("vehicles_plate_idx").on(t.plateNumber),
    index("vehicles_vin_idx").on(t.vin),
  ]
);

// ─── Repair Jobs ──────────────────────────────────────────────────────────────

export const repairJobs = pgTable(
  "repair_jobs",
  {
    id:            uuid("id").defaultRandom().primaryKey(),
    mechanicId:    uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
    vehicleId:     uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "restrict" }),
    customerId:    uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    jobNumber:     varchar("job_number", { length: 30 }).notNull().unique(),
    status:        jobStatusEnum("status").notNull().default("PENDING"),
    description:   text("description"),
    voiceNoteKey:  text("voice_note_key"),
    mileageAtJob:  integer("mileage_at_job"),
    laborCostGhs:  numeric("labor_cost_ghs", { precision: 10, scale: 2 }),
    partsCostGhs:  numeric("parts_cost_ghs", { precision: 10, scale: 2 }),
    totalCostGhs:  numeric("total_cost_ghs", { precision: 10, scale: 2 }),
    jobDate:       date("job_date").notNull(),
    completedAt:   timestamp("completed_at"),
    recordedBy:    uuid("recorded_by").references(() => staffUsers.id),
    createdAt:     timestamp("created_at").defaultNow().notNull(),
    updatedAt:     timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("jobs_mechanic_idx").on(t.mechanicId),
    index("jobs_vehicle_idx").on(t.vehicleId),
    index("jobs_date_idx").on(t.jobDate),
  ]
);

// ─── Job Photos ───────────────────────────────────────────────────────────────

export const jobPhotos = pgTable("job_photos", {
  id:         uuid("id").defaultRandom().primaryKey(),
  jobId:      uuid("job_id").notNull().references(() => repairJobs.id, { onDelete: "cascade" }),
  fileKey:    text("file_key").notNull(),
  fileName:   varchar("file_name", { length: 255 }),
  photoType:  photoTypeEnum("photo_type").notNull().default("general"),
  sortOrder:  integer("sort_order").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// ─── Parts Used ───────────────────────────────────────────────────────────────

export const partsUsed = pgTable("parts_used", {
  id:           uuid("id").defaultRandom().primaryKey(),
  jobId:        uuid("job_id").notNull().references(() => repairJobs.id, { onDelete: "cascade" }),
  partName:     varchar("part_name", { length: 200 }).notNull(),
  partNumber:   varchar("part_number", { length: 100 }),
  quantity:     integer("quantity").notNull().default(1),
  unitCostGhs:  numeric("unit_cost_ghs", { precision: 10, scale: 2 }),
  receiptKey:   text("receipt_key"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ─── Part Life Expectancy ─────────────────────────────────────────────────────

export const partLifeExpectancy = pgTable("part_life_expectancy", {
  id:         uuid("id").defaultRandom().primaryKey(),
  partName:   varchar("part_name", { length: 200 }).notNull().unique(),
  lifeMonths: integer("life_months"),
  lifeKm:     integer("life_km"),
  notes:      text("notes"),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

// ─── Maintenance Schedule ─────────────────────────────────────────────────────

export const maintenanceSchedule = pgTable(
  "maintenance_schedule",
  {
    id:              uuid("id").defaultRandom().primaryKey(),
    mechanicId:      uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
    vehicleId:       uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    sourceJobId:     uuid("source_job_id").references(() => repairJobs.id, { onDelete: "set null" }),
    partName:        varchar("part_name", { length: 200 }).notNull(),
    dueDateEstimate: date("due_date_estimate"),
    dueKmEstimate:   integer("due_km_estimate"),
    isCompleted:     boolean("is_completed").notNull().default(false),
    completedJobId:  uuid("completed_job_id").references(() => repairJobs.id, { onDelete: "set null" }),
    alertSent:       boolean("alert_sent").notNull().default(false),
    notes:           text("notes"),
    createdAt:       timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("schedule_mechanic_idx").on(t.mechanicId),
    index("schedule_vehicle_idx").on(t.vehicleId),
    index("schedule_due_idx").on(t.dueDateEstimate),
  ]
);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id:             uuid("id").defaultRandom().primaryKey(),
    mechanicId:     uuid("mechanic_id").references(() => mechanics.id, { onDelete: "cascade" }),
    type:           varchar("type", { length: 50 }).notNull(),
    status:         varchar("status", { length: 20 }).notNull().default("pending"),
    recipientEmail: varchar("recipient_email", { length: 200 }),
    recipientName:  varchar("recipient_name", { length: 200 }),
    recipientTel:   varchar("recipient_tel", { length: 30 }),
    payload:        jsonb("payload").notNull().default({}),
    errorMessage:   text("error_message"),
    createdAt:      timestamp("created_at").defaultNow().notNull(),
    processedAt:    timestamp("processed_at"),
  },
  (t) => [
    index("alerts_status_idx").on(t.status),
    index("alerts_created_idx").on(t.createdAt),
  ]
);

// ─── ID Counters ──────────────────────────────────────────────────────────────

export const idCounters = pgTable(
  "id_counters",
  {
    mechanicId: uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
    name:       varchar("name", { length: 50 }).notNull(),
    lastValue:  integer("last_value").notNull().default(0),
  },
  (t) => [uniqueIndex("id_counters_mechanic_name_idx").on(t.mechanicId, t.name)]
);

// ─── Vehicle Registrations (per-vehicle charge) ───────────────────────────────
// When a mechanic registers a vehicle on behalf of a customer, a charge is
// auto-created. The mechanic collects this from the customer and pays AutoPass.

export const vehicleRegistrations = pgTable("vehicle_registrations", {
  id:         uuid("id").defaultRandom().primaryKey(),
  vehicleId:  uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  mechanicId: uuid("mechanic_id").notNull().references(() => mechanics.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  amountGhs:  numeric("amount_ghs", { precision: 10, scale: 2 }).notNull(),
  status:     varchar("status", { length: 20 }).notNull().default("pending"), // pending | paid | waived
  paidAt:     timestamp("paid_at"),
  reference:  varchar("reference", { length: 200 }),
  notes:      text("notes"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("vreg_mechanic_idx").on(t.mechanicId),
  index("vreg_status_idx").on(t.status),
]);

// ─── Customer OTPs ────────────────────────────────────────────────────────────
// Used for customer portal phone-number login.

export const customerOtps = pgTable(
  "customer_otps",
  {
    id:        uuid("id").defaultRandom().primaryKey(),
    tel:       varchar("tel", { length: 30 }).notNull(),
    otp:       varchar("otp", { length: 8 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt:    timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("otp_tel_idx").on(t.tel)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const mechanicsRelations = relations(mechanics, ({ many }) => ({
  staffUsers:    many(staffUsers),
  customers:     many(customers),
  vehicles:      many(vehicles),
  repairJobs:    many(repairJobs),
  subscriptions: many(subscriptions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  mechanic:   one(mechanics, { fields: [customers.mechanicId], references: [mechanics.id] }),
  vehicles:   many(vehicles),
  repairJobs: many(repairJobs),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  mechanic:   one(mechanics, { fields: [vehicles.mechanicId], references: [mechanics.id] }),
  customer:   one(customers, { fields: [vehicles.customerId], references: [customers.id] }),
  repairJobs: many(repairJobs),
  schedule:   many(maintenanceSchedule),
}));

export const repairJobsRelations = relations(repairJobs, ({ one, many }) => ({
  mechanic: one(mechanics, { fields: [repairJobs.mechanicId], references: [mechanics.id] }),
  vehicle:  one(vehicles,  { fields: [repairJobs.vehicleId],  references: [vehicles.id] }),
  customer: one(customers, { fields: [repairJobs.customerId], references: [customers.id] }),
  photos:   many(jobPhotos),
  parts:    many(partsUsed),
}));
