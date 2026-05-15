import express from "express";
import path from "path";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "stream";
import fs from "fs";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config({ path: '.env.local' });
dotenv.config({ path: ".env.local", override: true });

// Root folder ID from user
const ROOT_FOLDER_ID = process.env.ROOT_FOLDER_ID || "0AK4D4vO9xm56Uk9PVA";
const PROVIDED_SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1rS9b6i_H4np17S-XRa_1plogHfAGRPmrNE8BXr2S7bU";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET || "";

async function callAppsScript(action: string, params: Record<string, unknown>, spreadsheetId: string): Promise<any> {
  if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL not configured. See appscript/Code.gs for setup.");
  const body = { action, spreadsheetId, token: APPS_SCRIPT_SECRET, ...params };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  return res.json();
}

export async function createExpressApp() {
  console.log("createExpressApp: START");
  const app = express();
  let SPREADSHEET_ID = PROVIDED_SPREADSHEET_ID;
  let DB_CONNECTED = false;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Service Account Auth
  let auth: any;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (serviceAccountEmail && privateKeyRaw) {
    try {
      console.log("Initializing Google Auth with separate env vars...");
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: serviceAccountEmail,
          private_key: privateKey,
        },
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/cloud-platform"
        ]
      });
      console.log("Service Account Auth initialized via separate env vars.");
    } catch (e) {
      console.error("CRITICAL: Failed to parse or initialize Google Auth credentials", e);
    }
  } else {
    console.warn("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables are missing.");
  }

  if (!auth) {
    // Fallback to local file
    try {
      if (fs.existsSync("./google-service-account.json")) {
        const credentials = JSON.parse(fs.readFileSync("./google-service-account.json", "utf8"));
        auth = google.auth.fromJSON(credentials);
        auth.scopes = [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/cloud-platform"
        ];
        console.log("Fallback: Service Account Auth initialized via file.");
      }
    } catch (e) {
      console.error("Failed to find or initialize from google-service-account.json", e);
    }
  }

  if (!auth) {
    console.warn("NO AUTHENTICATION PROVIDED FOR GOOGLE APIS. Database operations will fail.");
  }

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });
  const vision = google.vision({ version: "v1", auth });

  // 1. Ensure Spreadsheet and Tabs Exist
  const initializeDatabase = async () => {
    if (!auth) return;
    try {
      console.log("Checking connection to provided Spreadsheet:", SPREADSHEET_ID);

      // Check if we can access the spreadsheet
      const ssMeta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const sheetNames = ssMeta.data.sheets?.map(s => s.properties?.title) || [];
      const requiredSheets = ["Expenses", "Projects", "Categories", "Users"];

      const missingSheets = requiredSheets.filter(name => !sheetNames.includes(name));

      if (missingSheets.length > 0) {
        console.log("Adding missing sheets to existing database:", missingSheets);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: missingSheets.map(title => ({
              addSheet: { properties: { title } }
            }))
          }
        });
      }

      // Check and update headers for new functionality
      const updateHeaders = async (sheetName: string, expectedHeaders: string[]) => {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
        const currentHeaders = res.data.values?.[0] || [];
        const missing = expectedHeaders.filter(h => !currentHeaders.includes(h));
        if (missing.length > 0) {
          console.log(`Updating headers for ${sheetName}...`);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: [expectedHeaders] }
          });
        }
      };

      await updateHeaders("Expenses", ["id", "userId", "userName", "vendorName", "amount", "date", "category", "projectId", "status", "rejectionReason", "imageUrl", "createdAt", "location"]);
      await updateHeaders("Projects", ["id", "name", "location", "status", "advanceAmount"]);
      await updateHeaders("Users", ["id", "name", "email", "role", "password", "isApproved", "googleId", "projectAssigned"]);

      // Seed defaults if missing
      const usersCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A2:E2" });
      if (!usersCheck.data.values?.length) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: "Users!A2:H", valueInputOption: "RAW",
          requestBody: { values: [["admin1", "Super Admin", "admin@fieldspend.com", "ADMIN", "field123", "TRUE", "", ""]] }
        });
      }

      // 1.1 Ensure Spreadsheet is in the designated Shared Folder
      try {
        const fileMeta = await drive.files.get({
          fileId: SPREADSHEET_ID,
          fields: "parents",
          supportsAllDrives: true
        });

        if (!fileMeta.data.parents?.includes(ROOT_FOLDER_ID)) {
          console.log("Moving spreadsheet to designated root folder...");
          const previousParents = fileMeta.data.parents?.join(",") || "";
          await drive.files.update({
            fileId: SPREADSHEET_ID,
            addParents: ROOT_FOLDER_ID,
            removeParents: previousParents,
            supportsAllDrives: true
          });
        }
      } catch (moveErr) {
        console.warn("Could not move spreadsheet to root folder (might be due to permissions):", moveErr);
      }

      DB_CONNECTED = true;
      console.log("Successfully connected to Google Sheets DB:", SPREADSHEET_ID);
    } catch (err) {
      console.error("Initialization error - attempting fallback search:", err);
      // Fallback search logic in case provided ID fails but "FieldSpend_Database" exists in root folder
      try {
        const q = `name = 'FieldSpend_Database' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and '${ROOT_FOLDER_ID}' in parents`;
        const search = await drive.files.list({ q, supportsAllDrives: true, includeItemsFromAllDrives: true, fields: "files(id)" });
        let id = search.data.files?.[0]?.id;
        if (id) {
          SPREADSHEET_ID = id;
          DB_CONNECTED = true;
          console.log("Fallback: Connected to found Spreadsheet:", SPREADSHEET_ID);
        } else {
          DB_CONNECTED = false;
        }
      } catch (fallbackErr) {
        console.error("Fallback search failed:", fallbackErr);
        DB_CONNECTED = false;
      }
    }
  };

  // Start initialization in background
  initializeDatabase().catch(err => console.error("Background initialization failed:", err));

  // DB Status API
  app.get("/api/db-status", (req, res) => {
    res.json({
      connected: DB_CONNECTED && !!SPREADSHEET_ID,
      spreadsheetId: SPREADSHEET_ID,
      url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
    });
  });

  // Data Fetching API
  app.get("/api/data", async (req, res) => {
    try {
      const resp = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges: ["Expenses!A2:M", "Projects!A2:E", "Categories!A2:A", "Users!A2:H"]
      });

      const [expRows, projRows, catRows, userRows] = resp.data.valueRanges || [];

      const expenses = (expRows.values || []).map(row => ({
        id: row[0], userId: row[1], userName: row[2], vendorName: row[3],
        amount: parseFloat(row[4] || "0"), date: row[5], category: row[6],
        projectId: row[7], status: row[8], rejectionReason: row[9],
        imageUrl: row[10], createdAt: row[11], location: row[12] || ""
      }));

      const projects = (projRows.values || []).map(row => ({
        id: row[0], name: row[1], location: row[2], status: row[3] || 'ACTIVE',
        advanceAmount: parseFloat(row[4]) || 0
      }));

      const categories = (catRows.values || []).map(row => row[0]);

      const users = (userRows?.values || []).map(row => ({
        id: row[0], name: row[1], email: row[2], role: row[3], password: row[4],
        isApproved: row[5] === "TRUE", googleId: row[6] || "",
        projectAssigned: row[7] || ""
      }));

      res.json({ expenses, projects, categories, users });
    } catch (err: any) {
      console.error("DATA_FETCH_ERROR:", err);
      res.status(500).json({
        error: err.message,
        details: "Check if Google Sheets API is enabled and GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY are correct."
      });
    }
  });

  // Upload and Store Expense
  app.post("/api/expenses", async (req, res) => {
    const { expense, files } = req.body;
    try {
      let finalLinks: string[] = expense.imageUrl ? [expense.imageUrl] : [];

      if (files && Array.isArray(files) && files.length > 0) {
        const d = new Date(expense.date);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

        const findOrCreateFolder = async (name: string, parentId: string) => {
          const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`;
          const find = await drive.files.list({
            q,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: "files(id)"
          });

          if (find.data.files?.length) return find.data.files[0].id;

          const folder = await drive.files.create({
            requestBody: {
              name,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentId]
            },
            fields: "id",
            supportsAllDrives: true
          });
          return folder.data.id;
        };

        const monthId = await findOrCreateFolder(monthYear, ROOT_FOLDER_ID);
        const projId = await findOrCreateFolder(expense.projectName || "General", monthId!);

        for (const fileItem of files) {
          const { base64, name, type } = fileItem;
          const buffer = Buffer.from(base64, 'base64');

          const driveFile = await drive.files.create({
            requestBody: {
              name: name || `Exp_${expense.vendorName}_${expense.date}.jpg`,
              parents: [projId!]
            },
            media: {
              mimeType: type || 'image/jpeg',
              body: Readable.from(buffer)
            },
            fields: "id, webViewLink",
            supportsAllDrives: true
          });
          if (driveFile.data.webViewLink) {
            finalLinks.push(driveFile.data.webViewLink);
          }
        }
      }

      const row = [
        `EXP${Math.floor(Date.now() / 1000)}`, expense.userId, expense.userName,
        expense.vendorName, expense.amount, expense.date, expense.category,
        expense.projectId, "PENDING", "", finalLinks.join(","), new Date().toISOString(),
        expense.location || ""
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Expenses!A2:M",
        valueInputOption: "RAW",
        requestBody: { values: [row] }
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Expense post error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // User Management APIs
  app.post("/api/users", async (req, res) => {
    const { user } = req.body;
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Users!A2:G",
        valueInputOption: "RAW",
        requestBody: { values: [[user.id, user.name, user.email, user.role, user.password || "pass123", "TRUE", ""]] }
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:A" });
      const index = rows.data.values?.findIndex(r => r[0] === id);
      if (index !== undefined && index !== -1) {
        // Unfortunately Google Sheets API doesn't have a simple "delete row" by index in values.update
        // We'd need batchUpdate with deleteDimension
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })).data.sheets?.find(s => s.properties?.title === "Users")?.properties?.sheetId,
                  dimension: "ROWS",
                  startIndex: index,
                  endIndex: index + 1
                }
              }
            }]
          }
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Project Update (Name, Location, Status, Advance)
  app.patch("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    const { status, name, location, advanceAmount } = req.body;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Projects!A:A" });
      const index = rows.data.values?.findIndex(r => r[0] === id);
      if (index !== undefined && index !== -1) {
        const rowIndex = index + 1;
        const updates = [];
        if (name !== undefined) updates.push({ range: `Projects!B${rowIndex}`, values: [[name]] });
        if (location !== undefined) updates.push({ range: `Projects!C${rowIndex}`, values: [[location]] });
        if (status !== undefined) updates.push({ range: `Projects!D${rowIndex}`, values: [[status]] });
        if (advanceAmount !== undefined) updates.push({ range: `Projects!E${rowIndex}`, values: [[advanceAmount]] });

        if (updates.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              valueInputOption: "RAW",
              data: updates
            }
          });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Map Users to Project
  app.post("/api/projects/:id/map-users", async (req, res) => {
    const { id } = req.params;
    const { userIds } = req.body; // Array of user IDs to map to this project
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:A" });
      const usersData = rows.data.values || [];

      const updates = [];

      // For each user in userIds, set their project to 'id'
      // For users NOT in userIds but currently mapped to 'id', we might want to unmap them? 
      // User request says "map users", usually this means the new list is the ground truth.

      // Let's get full users data to see current assignments
      const fullUsers = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:H" });
      const fullUsersData = fullUsers.data.values || [];

      for (let i = 1; i < fullUsersData.length; i++) { // Skip header
        const userId = fullUsersData[i][0];
        const currentProj = fullUsersData[i][7] || "";
        const rowIndex = i + 1;

        if (userIds.includes(userId)) {
          if (currentProj !== id) {
            updates.push({ range: `Users!H${rowIndex}`, values: [[id]] });
          }
        } else if (currentProj === id) {
          // Unmap if it was previously mapped to this project
          updates.push({ range: `Users!H${rowIndex}`, values: [[""]] });
        }
      }

      if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: "RAW",
            data: updates
          }
        });
      }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // User Approval Update
  app.patch("/api/users/:id/approve", async (req, res) => {
    const { id } = req.params;
    const { isApproved } = req.body;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:A" });
      const index = rows.data.values?.findIndex(r => r[0] === id);
      if (index !== undefined && index !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Users!F${index + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [[isApproved ? "TRUE" : "FALSE"]] }
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // User Role Update
  app.patch("/api/users/:id/role", async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:A" });
      const index = rows.data.values?.findIndex(r => r[0] === id);
      if (index !== undefined && index !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Users!D${index + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [[role]] }
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    console.log(`LOGIN_ATTEMPT: ${email}`);
    try {
      console.log(`FETCHING_USERS_FOR_LOGIN: ${SPREADSHEET_ID}`);
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Users!A2:H"
      });
      const users = resp.data.values || [];
      console.log(`USERS_FOUND_COUNT: ${users.length}`);
      const userFound = users.find(u => {
        const uEmail = (u[2] || "").toString().trim().toLowerCase();
        const uPass = (u[4] || "").toString().trim();
        return uEmail === email.trim().toLowerCase() && uPass === password.trim();
      });
      if (userFound) {
        if (userFound[5] !== "TRUE") {
          return res.status(403).json({ error: "Your account is pending approval by an administrator." });
        }
        res.json({
          success: true,
          user: {
            id: userFound[0],
            name: userFound[1],
            email: userFound[2],
            role: userFound[3],
            isApproved: userFound[5] === "TRUE",
            googleId: userFound[6] || ""
          }
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "194963355909-b1c262c31b5lgcv1n4pnfmjqkrpn90ef.apps.googleusercontent.com";
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);

  app.post("/api/google-login", async (req, res) => {
    const { token } = req.body;
    console.log("GOOGLE_LOGIN_ATTEMPT");
    try {
      console.log("VERIFYING_GOOGLE_TOKEN...");
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (!payload) {
        console.error("GOOGLE_AUTH_FAILED: No payload");
        throw new Error("Invalid token payload");
      }

      const email = payload.email;
      const name = payload.name;
      const googleId = payload.sub;
      console.log(`GOOGLE_AUTH_SUCCESS: ${email} (${googleId})`);

      console.log(`FETCHING_USERS_FOR_GOOGLE_LOGIN: ${SPREADSHEET_ID}`);
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Users!A2:H"
      });
      const users = resp.data.values || [];
      let userFound = users.find(u => {
        const uEmail = (u[2] || "").toString().trim().toLowerCase();
        const uGoogleId = (u[6] || "").toString().trim();
        return uEmail === email?.toLowerCase() || uGoogleId === googleId;
      });

      if (userFound) {
        if (userFound[5] !== "TRUE") {
          return res.status(403).json({ error: "Your account is pending approval by an administrator." });
        }
        // Link google ID if not linked
        if (!userFound[6]) {
          const index = users.indexOf(userFound);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Users!G${index + 2}`,
            valueInputOption: "RAW",
            requestBody: { values: [[googleId]] }
          });
        }
        res.json({
          success: true,
          user: {
            id: userFound[0],
            name: userFound[1],
            email: userFound[2],
            role: userFound[3],
            isApproved: true,
            googleId: googleId
          }
        });
      } else {
        // Create new account if not exists (Pending approval)
        const newId = `USR${Math.floor(Date.now() / 1000)}`;
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Users!A2:G",
          valueInputOption: "RAW",
          requestBody: { values: [[newId, name, email, "FIELD_STAFF", "GOOGLE_AUTH", "FALSE", googleId]] }
        });
        res.status(403).json({ error: "Account created. Please wait for an administrator to approve your account." });
      }
    } catch (err: any) {
      console.error("GOOGLE_LOGIN_ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Google Vision OCR Proxy
  app.post("/api/ocr", async (req, res) => {
    const { base64 } = req.body;

    // Attempt using Service Account first (if auth is initialized)
    if (auth) {
      try {
        console.log("OCR: Attempting with Service Account...");
        const visionResp = await vision.images.annotate({
          requestBody: {
            requests: [
              {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION" }],
              },
            ],
          },
        });
        return res.json(visionResp.data);
      } catch (err: any) {
        console.warn("OCR: Service Account Vision API attempt failed, trying API Key fallback...", err.message);
      }
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({
        error: "Google Vision API failed and no GOOGLE_API_KEY is configured as fallback.",
        details: "Ensure Cloud Vision API is enabled for your service account or provide an API Key."
      });
    }

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION" }],
              },
            ],
          }),
        }
      );
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("OCR_PROXY_ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update Status
  app.patch("/api/expenses/:id", async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Expenses!A:A" });
      if (!rows.data.values) return res.status(500).json({ error: "Sheet data unavailable" });
      const index = rows.data.values.findIndex(r => r[0]?.toString().trim() === id.trim());
      if (index === -1) return res.status(404).json({ error: "Expense not found" });
      const rowIndex = index + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Expenses!I${rowIndex}:J${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[status, rejectionReason || ""]] }
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk Update Status
  app.patch("/api/expenses-bulk", async (req, res) => {
    const { ids, status, rejectionReason } = req.body;
    try {
      if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Invalid IDs" });
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Expenses!A:A" });
      if (!rows.data.values) return res.status(500).json({ error: "Sheet data unavailable" });
      const values = rows.data.values;
      const requests = ids.map((id: string) => {
        const index = values.findIndex(r => r[0]?.toString().trim() === id.trim());
        if (index !== -1) {
          const rowIndex = index + 1;
          return { range: `Expenses!I${rowIndex}:J${rowIndex}`, values: [[status, rejectionReason || ""]] };
        }
        return null;
      }).filter(Boolean);
      if (requests.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { valueInputOption: "RAW", data: requests as any[] }
        });
        res.json({ success: true, count: requests.length });
      } else {
        res.status(404).json({ error: "No matching expenses found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete single expense
  app.delete("/api/expenses/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await callAppsScript("deleteExpense", { id }, SPREADSHEET_ID);
      if (result.error) return res.status(404).json({ error: result.error });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Bulk delete expenses
  app.delete("/api/expenses-bulk", async (req, res) => {
    const ids = req.body?.ids;
    try {
      if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "Invalid IDs" });
      const result = await callAppsScript("bulkDeleteExpenses", { ids }, SPREADSHEET_ID);
      if (result.error) return res.status(404).json({ error: result.error });
      res.json({ success: true, count: result.count });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Edit single expense fields
  app.patch("/api/expenses/:id/edit", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Expenses!A:M" });
      if (!rows.data.values) return res.status(500).json({ error: "Sheet data unavailable" });
      const index = rows.data.values.findIndex(r => r[0]?.toString().trim() === id.trim());
      if (index === -1) return res.status(404).json({ error: "Expense not found" });
      const cur = rows.data.values![index];
      const newRow = [
        cur[0], cur[1], cur[2],
        updates.vendorName ?? cur[3],
        updates.amount ?? cur[4],
        updates.date ?? cur[5],
        updates.category ?? cur[6],
        updates.projectId ?? cur[7],
        updates.status ?? cur[8],
        updates.rejectionReason ?? cur[9] ?? "",
        cur[10] ?? "",
        cur[11] ?? "",
        updates.location ?? cur[12] ?? ""
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Expenses!A${index + 1}:M${index + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [newRow] }
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Bulk edit a single field across many expenses
  app.patch("/api/expenses-bulk-edit", async (req, res) => {
    const { ids, field, value } = req.body;
    const FIELD_COL: Record<string, number> = { vendorName: 3, amount: 4, date: 5, category: 6, projectId: 7, status: 8, location: 12 };
    try {
      const colIndex = FIELD_COL[field];
      if (colIndex === undefined) return res.status(400).json({ error: "Invalid field" });
      const rows = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Expenses!A:A" });
      const values = rows.data.values || [];
      const col = String.fromCharCode(65 + colIndex);
      const data = ids.map((id: string) => {
        const i = values.findIndex(r => r[0] === id);
        return i !== -1 ? { range: `Expenses!${col}${i + 1}`, values: [[value]] } : null;
      }).filter(Boolean);
      if (data.length === 0) return res.status(404).json({ error: "No matching expenses" });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: data as any[] }
      });
      res.json({ success: true, count: data.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await callAppsScript("deleteProject", { id }, SPREADSHEET_ID);
      if (result.error) return res.status(404).json({ error: result.error });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Admin Config routes
  app.post("/api/projects", async (req, res) => {
    const { project } = req.body;
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Projects!A2:E",
        valueInputOption: "RAW",
        requestBody: { values: [[project.id, project.name, project.location, project.status || 'ACTIVE', project.advanceAmount || 0]] }
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/categories", async (req, res) => {
    const { name } = req.body;
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: "Categories!A2:A",
        valueInputOption: "RAW", requestBody: { values: [[name]] }
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return app;
}
