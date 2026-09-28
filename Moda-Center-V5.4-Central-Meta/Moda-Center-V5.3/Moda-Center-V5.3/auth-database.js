const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const { mysqlEnabled, pool, ensureUsersTable } = require("./database");

function publicUser(user) {
    return {
        id: user.id,
        name: user.name || user.nome,
        email: user.email,
        avatar: user.avatar || null,
        profile: user.profile || user.perfil || "cliente"
    };
}

async function registerUser(input, jsonDatabase) {
    const name = String(input.name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const profile = ["cliente", "comerciante", "administrador"].includes(input.profile) ? input.profile : "cliente";
    if (name.length < 2 || !email || password.length < 6) return { status: 400, error: "Nome, e-mail e senha de 6 caracteres sao obrigatorios" };

    if (mysqlEnabled) {
        await ensureUsersTable();
        const [existing] = await pool.execute("SELECT id FROM usuarios WHERE email = ? LIMIT 1", [email]);
        if (existing.length) return { status: 409, error: "Este e-mail ja esta cadastrado" };
        const id = String(input.registrationId || crypto.randomUUID());
        const hash = await bcrypt.hash(password, 12);
        await pool.execute("INSERT INTO usuarios (id, nome, email, senha, perfil, avatar) VALUES (?, ?, ?, ?, ?, ?)", [id, name, email, hash, profile, input.avatar || null]);
        return { status: 201, user: publicUser({ id, name, email, profile, avatar: input.avatar }) };
    }

    const existing = jsonDatabase.users.find(user => user.email === email);
    if (existing) return { status: 409, error: "Este e-mail ja esta cadastrado" };
    const hash = await bcrypt.hash(password, 12);
    const user = { id: String(input.registrationId || crypto.randomUUID()), name, email, password: hash, profile, avatar: input.avatar || null };
    jsonDatabase.users.push(user);
    return { status: 201, user: publicUser(user), changed: true };
}

async function loginUser(input, jsonDatabase) {
    const emailInput = String(input.email || "").trim().toLowerCase();
    const email = emailInput === "admin" ? "admin@modacenter.com" : emailInput;
    const password = String(input.password || "");

    if (mysqlEnabled) {
        await ensureUsersTable();
        const [rows] = await pool.execute("SELECT id, nome, email, senha, perfil, avatar FROM usuarios WHERE email = ? LIMIT 1", [email]);
        if (!rows.length || !(await bcrypt.compare(password, rows[0].senha))) return { status: 401, error: "E-mail ou senha invalidos" };
        return { status: 200, user: publicUser(rows[0]) };
    }

    const user = jsonDatabase.users.find(item => item.email === email);
    const validPassword = user && (user.password.startsWith("$2")
        ? await bcrypt.compare(password, user.password)
        : user.password === password);
    let changed = false;
    if (user && validPassword && !user.password.startsWith("$2")) {
        user.password = await bcrypt.hash(password, 12);
        changed = true;
    }
    if (!user || !validPassword) return { status: 401, error: "E-mail ou senha invalidos" };
    return { status: 200, user: publicUser(user), changed };
}

async function syncUsers(users, jsonDatabase) {
    if (!Array.isArray(users)) return;
    for (const input of users) {
        if (!input.email || !input.password) continue;
        const result = await registerUser(input, jsonDatabase);
        if (result.changed) continue;
    }
}

module.exports = { registerUser, loginUser, syncUsers };