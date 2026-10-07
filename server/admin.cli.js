import readline from "readline";
import dbConn from "./database/db.config.js";
import bcrypt from "bcryptjs";

const theme = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  yellow: "\x1b[38;5;227m",
  olive: "\x1b[38;5;100m",
  red: "\x1b[38;5;203m",
  green: "\x1b[38;5;114m",
  orange: "\x1b[38;5;215m",
  gray: "\x1b[38;5;245m",
};

const paint = (color, text) => `${color}${text}${theme.reset}`;
const ansiPattern = /\x1b\[[0-9;]*m/g;
const visible = (text) => text.replace(ansiPattern, "").length;
const pad = (text, width) =>
  text + " ".repeat(Math.max(0, width - visible(text)));

const fields = [
  {
    key: "NAME",
    column: "aname",
    label: "Name",
    hint: "letters, spaces, - and ' only",
    regex: /^[a-zA-Z\s-']{2,72}$/,
  },
  {
    key: "EMAIL",
    column: "aemail",
    label: "Email",
    hint: "letters, digits and valid email characters",
    regex: /^(?=.{6,72}$)[a-zA-Z0-9._-]+@[a-zA-Z0-9_-]{2,}\.[a-zA-Z]{2,}$/,
  },
  {
    key: "PASSWORD",
    column: "apassword",
    label: "Password",
    hint: "8-40 chars, upper, lower, digit and special character",
    regex:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+=\-[\]{};:,./?\\|])[A-Za-z0-9!@#$%^&*()_+=\-[\]{};:,./?\\|]{8,40}$/,
  },
];

const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${paint(theme.yellow, "H.D.P")} ${paint(theme.gray, "(admin)")} ${paint(theme.yellow, "❯")} `,
});

cli.on("close", () => process.exit(0));

function box(title, rows, color = theme.yellow) {
  const inner = Math.max(
    visible(title) + 4,
    ...rows.map(visible).map((n) => n + 2),
  );
  const top = `${color}┌─ ${theme.bold}${title}${theme.reset}${color} ${"─".repeat(inner - visible(title) - 3)}┐${theme.reset}`;
  const bottom = `${color}└${"─".repeat(inner)}┘${theme.reset}`;
  const body = rows.map(
    (row) =>
      `${color}│${theme.reset} ${pad(row, inner - 2)} ${color}│${theme.reset}`,
  );
  console.log(["", top, ...body, bottom, ""].join("\n"));
}

function table(title, headers, rows, color = theme.yellow) {
  const widths = headers.map((header, index) =>
    Math.max(
      visible(header),
      ...rows.map((row) => visible(String(row[index]))),
    ),
  );
  const line = (cells) =>
    cells.map((cell, index) => pad(String(cell), widths[index])).join("   ");
  const head = paint(
    theme.gray,
    line(headers.map((header) => header.toUpperCase())),
  );
  const divider = paint(
    theme.olive,
    widths.map((width) => "─".repeat(width)).join("───"),
  );
  box(title, [head, divider, ...rows.map(line)], color);
}

const success = (message) =>
  console.log(`  ${paint(theme.green, "✔")} ${message}\n`);
const fail = (message) =>
  console.log(`  ${paint(theme.red, "✖")} ${message}\n`);
const info = (message) =>
  console.log(`  ${paint(theme.yellow, "›")} ${message}\n`);
const warn = (message) =>
  console.log(`  ${paint(theme.orange, "!")} ${message}\n`);

async function working(label, task) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;
  const timer = setInterval(() => {
    process.stdout.write(
      `\r  ${paint(theme.yellow, frames[frame++ % frames.length])} ${paint(theme.gray, label)}`,
    );
  }, 80);
  try {
    return await task();
  } finally {
    clearInterval(timer);
    process.stdout.write("\r\x1b[2K");
  }
}

function ask(label, hint = "") {
  const suffix = hint ? ` ${paint(theme.gray, `(${hint})`)}` : "";
  return new Promise((resolve) => {
    cli.question(
      `  ${paint(theme.yellow, "?")} ${label}${suffix} ${paint(theme.yellow, "›")} `,
      resolve,
    );
  });
}

function statusTag(blocked) {
  return blocked
    ? paint(theme.red, "● BLOCKED")
    : paint(theme.green, "● ACTIVE");
}

function adminTable(title, admins) {
  if (!admins.length) {
    box(title, [paint(theme.gray, "No admins found")], theme.red);
    return;
  }
  table(
    `${title} · ${admins.length}`,
    ["ID", "Name", "Email", "Status"],
    admins.map((admin) => [
      paint(theme.yellow, admin.Aid),
      admin.Aname,
      paint(theme.gray, admin.Aemail),
      statusTag(admin.blocked),
    ]),
  );
}

function invalidField(field) {
  box(
    `INVALID ${field.key}`,
    [`Requirement: ${paint(theme.gray, field.hint)}`, "Please try again"],
    theme.red,
  );
}

function showBanner() {
  console.clear();
  console.log(
    paint(
      theme.yellow,
      [
        "",
        "  ██╗  ██╗███████╗██╗     ██████╗   ██████╗  ███████╗███████╗██╗  ██╗     ██████╗ ██████╗  ██████╗ ",
        "  ██║  ██║██╔════╝██║     ██╔══██╗  ██╔══██╗ ██╔════╝██╔════╝██║ ██╔╝     ██╔══██╗██╔══██╗██╔═══██╗",
        "  ███████║█████╗  ██║     ██████╔╝  ██║  ██║ █████╗  ███████╗█████╔╝      ██████╔╝██████╔╝██║   ██║",
        "  ██╔══██║██╔══╝  ██║     ██╔═══╝   ██║  ██║ ██╔══╝  ╚════██║██╔═██╗      ██╔═══╝ ██╔══██╗██║   ██║",
        "  ██║  ██║███████╗███████╗██║       ██████╔╝ ███████╗███████║██║  ██╗     ██║     ██║  ██║╚██████╔╝",
        "  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝       ╚═════╝  ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ",
        "",
      ].join("\n"),
    ),
  );
  box("HELPDESK PRO · INTERNAL SYSTEM TERMINAL", [
    `Type ${paint(theme.yellow, "help")} for the command list`,
    `Type ${paint(theme.yellow, "exit")} to close the connection`,
  ]);
}

function showHelp() {
  const commands = [
    ["insert", "Add a new admin"],
    ["list", "Show all admins"],
    ["find", "Find an admin by id or name"],
    ["update", "Update an existing admin"],
    ["block", "Toggle an admin's blocked status"],
    ["delete", "Information about revoking admins"],
    ["exit", "Close the terminal"],
  ];
  box(
    "COMMANDS",
    commands.map(
      ([name, description]) =>
        `${paint(theme.yellow, pad(name, 8))} ${description}`,
    ),
  );
}

function showDeleteNotice() {
  box(
    "WARNING · DELETE DISABLED",
    [
      "Admins cannot be deleted from the CLI",
      "Admins oversee ongoing processes, deleting an",
      "active admin can cause a fatal error",
      "",
      "Please approach the DBA to revoke an admin",
    ],
    theme.red,
  );
}

async function insertAdmin() {
  box("NEW ADMIN", [
    "Enter the required fields",
    `Enter ${paint(theme.yellow, "-1")} to cancel at any time`,
  ]);

  const values = {};

  for (const field of fields) {
    const answer = await ask(field.label, field.hint);

    if (answer.trim() === "-1") {
      info("Insert cancelled");
      return;
    }

    if (!field.regex.test(answer)) {
      invalidField(field);
      return;
    }

    values[field.key] = answer;
  }

  const saved = await working("Saving admin", () =>
    saveNewAdmin(values.NAME, values.EMAIL, values.PASSWORD),
  );

  if (saved) success(`Admin ${paint(theme.yellow, values.NAME)} added`);
  else fail("An error occurred, please try again");
}

async function listAdmins() {
  const admins = await working("Fetching admins", async () => {
    const [data] = await dbConn.query(
      "select Aid, Aname, Aemail, blocked from admin",
    );
    return data;
  });
  adminTable("ALL ADMINS", admins);
}

async function findAdmin() {
  const mode = (
    await ask(
      "Search by",
      `${paint(theme.yellow, "id")} or ${paint(theme.yellow, "name")}`,
    )
  )
    .trim()
    .toLowerCase();

  if (mode !== "id" && mode !== "name") {
    fail("Invalid choice, aborting");
    return;
  }

  const value = (await ask(mode === "id" ? "Admin ID" : "Admin name")).trim();
  const column = mode === "id" ? "Aid" : "Aname";

  const admins = await working("Searching", async () => {
    const [data] = await dbConn.query(
      `select Aid, Aname, Aemail, blocked from admin where ${column} = ?`,
      [value],
    );
    return data;
  });

  adminTable("SEARCH RESULTS", admins);
}

async function updateAdmin() {
  box("UPDATE ADMIN", [
    `Enter ${paint(theme.yellow, "-1")} to cancel`,
    `Enter ${paint(theme.yellow, "0")} to skip a field`,
  ]);

  const id = (await ask("Admin ID", "required")).trim();
  const connection = await dbConn.getConnection();

  try {
    await connection.beginTransaction();

    const [found] = await connection.query(
      "select aid from admin where aid = ?",
      [id],
    );

    if (!found.length) {
      await connection.rollback();
      fail(`No admin found for id ${paint(theme.yellow, id)}`);
      return;
    }

    const changed = [];

    for (const field of fields) {
      const answer = await ask(field.label, field.hint);

      if (answer.trim() === "-1") {
        await connection.rollback();
        info("Update cancelled, no changes saved");
        return;
      }

      if (answer.trim() === "0") continue;

      if (!field.regex.test(answer)) {
        await connection.rollback();
        invalidField(field);
        return;
      }

      const value =
        field.key === "PASSWORD" ? await bcrypt.hash(answer, 12) : answer;

      await connection.query(
        `update admin set ${field.column} = ? where aid = ?`,
        [value, id],
      );
      changed.push(field.label);
    }

    if (!changed.length) {
      await connection.rollback();
      info("Nothing to update");
      return;
    }

    await working("Committing update", () => connection.commit());
    success(`Admin ${paint(theme.yellow, id)} updated · ${changed.join(", ")}`);
  } catch (error) {
    await connection.rollback().catch(() => {});
    fail("Database error, changes not committed");
  } finally {
    connection.release();
  }
}

async function toggleBlock() {
  box(
    "TOGGLE BLOCK STATUS",
    [
      "This toggles the admin's blocked status",
      "Verify the current status before continuing",
    ],
    theme.orange,
  );

  const id = (await ask("Admin ID", "-1 to cancel")).trim();

  if (id === "-1") {
    info("Cancelled");
    return;
  }

  const result = await working("Updating status", async () => {
    const [update] = await dbConn.query(
      "update admin set blocked = !blocked where aid = ?",
      [id],
    );
    if (update.affectedRows === 0) return null;
    const [rows] = await dbConn.query(
      "select Aname, blocked from admin where aid = ?",
      [id],
    );
    return rows[0];
  });

  if (!result) {
    fail("Invalid admin id");
    return;
  }

  success(
    `${paint(theme.yellow, result.Aname)} is now ${statusTag(result.blocked)}`,
  );
}

function exitCli() {
  console.log(`\n  ${paint(theme.yellow, "›")} Closing the application. . .\n`);
  cli.close();
}

async function saveNewAdmin(name, email, password) {
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await dbConn.query(
      "insert into ADMIN(aname, aemail, apassword) values(?, ?, ?)",
      [name, email, passwordHash],
    );
    return true;
  } catch (error) {
    fail(`CLI error {saveNewAdmin}: ${error.message}`);
    return false;
  }
}

const commands = {
  help: showHelp,
  insert: insertAdmin,
  list: listAdmins,
  find: findAdmin,
  update: updateAdmin,
  delete: showDeleteNotice,
  block: toggleBlock,
  exit: exitCli,
};

function startCli() {
  showBanner();
  cli.prompt();

  cli.on("line", async (line) => {
    const input = line.trim().toLowerCase();

    if (input) {
      const handler = commands[input];

      if (!handler) {
        warn(
          `Unknown command: ${paint(theme.yellow, input)} · type ${paint(theme.yellow, "help")}`,
        );
      } else {
        try {
          await handler();
        } catch (error) {
          fail(`CLI error {${input}}: ${error.message}`);
        }
      }
    }

    cli.prompt();
  });
}

startCli();
