import { google } from "googleapis";
import fs from "fs";

const SPREADSHEET_ID = "1rS9b6i_H4np17S-XRa_1plogHfAGRPmrNE8BXr2S7bU";

async function seed() {
  const credentials = JSON.parse(fs.readFileSync("./round-centaur-496305-r0-5154042e8991.json", "utf8"));
  const auth = google.auth.fromJSON(credentials) as any;
  auth.scopes = ["https://www.googleapis.com/auth/spreadsheets"];

  const sheets = google.sheets({ version: "v4", auth });

  // ── Users ──────────────────────────────────────────────────────────────────
  // id | name | email | role | password | isApproved | googleId | projectAssigned
  const users = [
    ["admin1",  "Super Admin",     "admin@fieldspend.com",   "ADMIN",       "field123", "TRUE",  "", ""],
    ["user1",   "Arjun Mehta",     "arjun.m@clovetech.com",  "FIELD_STAFF", "pass123",  "TRUE",  "", "PRJ001"],
    ["user2",   "Priya Sharma",    "priya.s@clovetech.com",  "FIELD_STAFF", "pass123",  "TRUE",  "", "PRJ002"],
    ["user3",   "Rohan Nair",      "rohan.n@clovetech.com",  "FIELD_STAFF", "pass123",  "TRUE",  "", "PRJ003"],
    ["user4",   "Sneha Kulkarni",  "sneha.k@clovetech.com",  "FIELD_STAFF", "pass123",  "FALSE", "", "PRJ001"],
  ];

  // ── Projects ───────────────────────────────────────────────────────────────
  // id | name | location | status
  const projects = [
    ["PRJ001", "Metro Survey - Mumbai",    "Mumbai",    "ACTIVE"],
    ["PRJ002", "LiDAR Mapping - Delhi",    "Delhi",     "ACTIVE"],
    ["PRJ003", "Smart City - Bangalore",   "Bangalore", "ACTIVE"],
    ["PRJ004", "Road Survey - Hyderabad",  "Hyderabad", "COMPLETED"],
  ];

  // ── Categories ─────────────────────────────────────────────────────────────
  const categories = [
    ["Food"],
    ["Travel"],
    ["Fuel"],
    ["Lodging"],
    ["Equipment"],
    ["Miscellaneous"],
  ];

  // ── Expenses ───────────────────────────────────────────────────────────────
  // id | userId | userName | vendorName | amount | date | category | projectId
  // | status | rejectionReason | imageUrl | createdAt | location
  const expenses = [
    ["EXP001", "user1", "Arjun Mehta",    "Hotel Residency",       "2800", "2025-05-01", "Lodging",       "PRJ001", "APPROVED",  "",                        "", "2025-05-01T09:00:00Z", "Mumbai"],
    ["EXP002", "user1", "Arjun Mehta",    "Petrol Pump Andheri",   "650",  "2025-05-02", "Fuel",          "PRJ001", "APPROVED",  "",                        "", "2025-05-02T08:30:00Z", "Mumbai"],
    ["EXP003", "user1", "Arjun Mehta",    "Udupi Restaurant",      "480",  "2025-05-02", "Food",          "PRJ001", "PENDING",   "",                        "", "2025-05-02T13:00:00Z", "Mumbai"],
    ["EXP004", "user1", "Arjun Mehta",    "Rapido Auto",           "220",  "2025-05-03", "Travel",        "PRJ001", "REJECTED",  "Amount seems too high",   "", "2025-05-03T10:00:00Z", "Mumbai"],
    ["EXP005", "user2", "Priya Sharma",   "Hotel Crown Plaza",     "3500", "2025-05-01", "Lodging",       "PRJ002", "APPROVED",  "",                        "", "2025-05-01T10:00:00Z", "Delhi"],
    ["EXP006", "user2", "Priya Sharma",   "Delhi Metro Card",      "300",  "2025-05-02", "Travel",        "PRJ002", "APPROVED",  "",                        "", "2025-05-02T09:00:00Z", "Delhi"],
    ["EXP007", "user2", "Priya Sharma",   "Survey Equipment Rent", "5200", "2025-05-03", "Equipment",     "PRJ002", "PENDING",   "",                        "", "2025-05-03T11:00:00Z", "Delhi"],
    ["EXP008", "user2", "Priya Sharma",   "Haldiram's",            "350",  "2025-05-04", "Food",          "PRJ002", "APPROVED",  "",                        "", "2025-05-04T13:30:00Z", "Delhi"],
    ["EXP009", "user3", "Rohan Nair",     "Ola Cab",               "780",  "2025-05-01", "Travel",        "PRJ003", "APPROVED",  "",                        "", "2025-05-01T08:00:00Z", "Bangalore"],
    ["EXP010", "user3", "Rohan Nair",     "HP Petrol Bunk",        "900",  "2025-05-02", "Fuel",          "PRJ003", "PENDING",   "",                        "", "2025-05-02T07:30:00Z", "Bangalore"],
    ["EXP011", "user3", "Rohan Nair",     "Lens & More",           "1200", "2025-05-03", "Equipment",     "PRJ003", "APPROVED",  "",                        "", "2025-05-03T14:00:00Z", "Bangalore"],
    ["EXP012", "user3", "Rohan Nair",     "MTR Restaurant",        "560",  "2025-05-04", "Food",          "PRJ003", "REJECTED",  "Receipt not attached",    "", "2025-05-04T12:00:00Z", "Bangalore"],
    ["EXP013", "user1", "Arjun Mehta",    "Stationery Mart",       "340",  "2025-05-05", "Miscellaneous", "PRJ001", "PENDING",   "",                        "", "2025-05-05T10:00:00Z", "Mumbai"],
    ["EXP014", "user2", "Priya Sharma",   "BPCL Fuel Station",     "1100", "2025-05-05", "Fuel",          "PRJ002", "APPROVED",  "",                        "", "2025-05-05T08:00:00Z", "Delhi"],
    ["EXP015", "user3", "Rohan Nair",     "Treebo Inn",            "2200", "2025-05-05", "Lodging",       "PRJ003", "PENDING",   "",                        "", "2025-05-05T09:00:00Z", "Bangalore"],
  ];

  console.log("Seeding Users...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Users!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["id","name","email","role","password","isApproved","googleId","projectAssigned"], ...users] },
  });

  console.log("Seeding Projects...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Projects!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["id","name","location","status"], ...projects] },
  });

  console.log("Seeding Categories...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Categories!A1",
    valueInputOption: "RAW",
    requestBody: { values: [["category"], ...categories] },
  });

  console.log("Seeding Expenses...");
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Expenses!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        ["id","userId","userName","vendorName","amount","date","category","projectId","status","rejectionReason","imageUrl","createdAt","location"],
        ...expenses
      ]
    },
  });

  console.log("\n✓ Seed complete!");
  console.log(`  ${users.length} users`);
  console.log(`  ${projects.length} projects`);
  console.log(`  ${categories.length} categories`);
  console.log(`  ${expenses.length} expenses (APPROVED / PENDING / REJECTED mix)`);
  console.log("\nLogin credentials:");
  console.log("  Admin  → admin@fieldspend.com  / field123");
  console.log("  Staff  → arjun.m@clovetech.com / pass123");
  console.log("  Staff  → priya.s@clovetech.com / pass123");
  console.log("  Staff  → rohan.n@clovetech.com / pass123");
}

seed().catch(err => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
