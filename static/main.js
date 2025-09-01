const Strength = (() => {
    const defaults = {
        minLength: 12,
        minUnique: 5,
        banned: [
            "password", "123456", "123456789", "qwerty", "abc123", "111111", "123123", "iloveyou", "admin",
            "welcome", "passw0rd", "qwertyuiop", "letmein", "dragon", "football", "monkey", "654321", "12345",
            "1q2w3e4r", "zaq12wsx", "qazwsx", "trustno1", "starwars", "asdfgh", "pokemon", "000000", "qweasd"
        ],
        sequences: [
            "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm",
            "0123456789"
        ],
        leetMap: { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "9": "g" }
    };

    const hasLower = s => /[a-z]/.test(s);
    const hasUpper = s => /[A-Z]/.test(s);
    const hasDigit = s => /\d/.test(s);
    const hasSymbol = s => /[^A-Za-z0-9]/.test(s);

    const uniqueCount = s => new Set([...s]).size;

    function normalizeLeet(s, map) {
        return s.toLowerCase().split("").map(ch => map[ch] || ch).join("");
    }

    function containsSequence(s, list) {
        const lower = s.toLowerCase();
        for (const seq of list) {
            if (hasRun(lower, seq) || hasRun(lower, [...seq].reverse().join(""))) {
                return true;
            }
        }
        return false;
    }
    function hasRun(hay, seq) {
        for (let i = 0; i <= seq.length - 3; i++) {
            const run = seq.slice(i, i + 3);
            if (hay.includes(run)) return true;
        }
        return false;
    }

    function repeatsPenalty(s) {
        const m = s.match(/(.)\1{2,}/g);
        return m ? Math.min(20, m.join("").length * 2) : 0;
    }

    function dateLikePenalty(s) {
        let p = 0;
        if (/(19|20)\d{2}/.test(s)) p += 8;
        if (/\d{2}[\/\-.]\d{2}[\/\-.](\d{2}|\d{4})/.test(s)) p += 8;
        if (/^\d+$/.test(s)) p += Math.min(25, s.length * 2);
        return p;
    }

    function charspace(s) {
        let N = 0;
        if (hasLower(s)) N += 26;
        if (hasUpper(s)) N += 26;
        if (hasDigit(s)) N += 10;
        if (hasSymbol(s)) N += 33;
        return Math.max(N, 1);
    }

    function scorePassword(pw, opt = {}) {
        const o = { ...defaults, ...opt };
        const L = pw.length;

        const checks = {
            length: L >= o.minLength,
            unique: uniqueCount(pw) >= o.minUnique,
            lower: hasLower(pw),
            upper: hasUpper(pw),
            digit: hasDigit(pw),
            symbol: hasSymbol(pw)
        };

        const normalized = normalizeLeet(pw, o.leetMap);
        const isBanned = o.banned.includes(pw.toLowerCase()) || o.banned.includes(normalized);

        let score = 0;

        if (L >= o.minLength) {
            score += Math.min(40, (L - o.minLength + 1) * 4 + 20); // 12 → 24, 16+ → ~40
        } else {
            score += Math.max(0, L * 2);
        }

        const diversity = ["lower", "upper", "digit", "symbol"].reduce((a, k) => a + (checks[k] ? 1 : 0), 0);
        score += diversity * 7;

        const uniq = uniqueCount(pw);
        score += Math.min(20, Math.max(0, (uniq - 4) * 2));

        let penalty = 0;
        if (containsSequence(pw, o.sequences)) penalty += 18;
        penalty += repeatsPenalty(pw);
        penalty += dateLikePenalty(pw);
        if (isBanned) penalty += 40;

        score = Math.max(0, Math.min(100, score - penalty));

        const entropyBits = L * Math.log2(charspace(pw));

        let level = "very-weak", label = "Çok Zayıf";
        if (score >= 80) { level = "very-strong"; label = "Çok Güçlü"; }
        else if (score >= 60) { level = "strong"; label = "Güçlü"; }
        else if (score >= 40) { level = "medium"; label = "Orta"; }
        else if (score >= 20) { level = "weak"; label = "Zayıf"; }

        const tips = [];
        if (isBanned) tips.push("Yaygın/kolay tahmin edilebilir bir şifre; tamamen değiştirin.");
        if (!checks.length) tips.push(`En az ${o.minLength} karakter kullanın.`);
        if (!checks.unique) tips.push(`En az ${o.minUnique} benzersiz karakter kullanın (tekrarları azaltın).`);
        if (diversity < 3) tips.push("Büyük/küçük harf, rakam ve sembollerden en az üçünü birlikte kullanın.");
        if (containsSequence(pw, o.sequences)) tips.push("Ardışık klavye/dizi kalıplarını (abc, 123, qwerty) kırın.");
        if (repeatsPenalty(pw) > 0) tips.push("Aynı karakteri peş peşe tekrarlamaktan kaçının.");
        if (dateLikePenalty(pw) > 0) tips.push("Tarih/yıl veya yalnız rakamlardan oluşan kalıpları kullanmayın.");
        if (tips.length === 0 && score < 100) tips.push("Daha uzun ve rastgele bir parola ile 80+ puana çıkabilirsiniz.");

        return { score, level, label, checks, entropyBits, tips, length: L, uniq };
    }

    return { scorePassword };
})();

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("password");
    const toggle = document.getElementById("toggle");
    const meter = document.getElementById("meter");
    const verdict = document.getElementById("verdict");
    const entropy = document.getElementById("entropy");
    const tipsList = document.getElementById("tipsList");
    const lengthBadge = document.getElementById("lengthBadge");
    const uniqueBadge = document.getElementById("uniqueBadge");

    function updateUI(pw) {
        const res = Strength.scorePassword(pw);

        const segments = meter.querySelectorAll("span");
        const filled = Math.ceil(res.score / 20); // 0..5
        segments.forEach((seg, i) => seg.classList.toggle("on", i < filled));
        meter.dataset.level = res.level;

        verdict.textContent = res.label;
        entropy.textContent = res.length
            ? `Entropi ≈ ${res.entropyBits.toFixed(1)} bit`
            : "";

        lengthBadge.textContent = `Uzunluk: ${res.length}`;
        uniqueBadge.textContent = `Benzersiz: ${res.uniq}`;

        const checkMap = {
            length: res.checks.length,
            unique: res.checks.unique,
            lower: res.checks.lower,
            upper: res.checks.upper,
            digit: res.checks.digit,
            symbol: res.checks.symbol
        };
        for (const [k, ok] of Object.entries(checkMap)) {
            const el = document.querySelector(`.chip[data-check="${k}"]`);
            if (el) el.classList.toggle("ok", !!ok);
        }

        tipsList.innerHTML = "";
        res.tips.forEach(t => {
            const li = document.createElement("li");
            li.textContent = t;
            tipsList.appendChild(li);
        });
    }

    toggle.addEventListener("click", () => {
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
    });

    input.addEventListener("input", (e) => updateUI(e.target.value));
    updateUI(""); 
});
