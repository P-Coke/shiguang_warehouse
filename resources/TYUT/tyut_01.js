function getRequestVerificationToken() {
    return document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";
}

function parseWeeksFromBinary(binary) {
    if (!binary || typeof binary !== "string") return [];
    const weeks = [];
    for (let i = 0; i < binary.length; i++) {
        if (binary[i] === "1") {
            weeks.push(i + 1);
        }
    }
    return weeks;
}

function normalizePosition(row) {
    if (row.Dd && String(row.Dd).trim()) {
        return String(row.Dd).trim();
    }

    return [row.Xqm, row.Jxlm, row.Jasm]
        .map(value => value == null ? "" : String(value).trim())
        .filter(Boolean)
        .join(" ");
}

function toCourse(row) {
    const day = Number(row.Skxq);
    const startSection = Number(row.Skjc);
    const duration = Number(row.Cxjc);
    const weeks = parseWeeksFromBinary(row.Skzc);

    if (!String(row.Kcm || "").trim()) return null;
    if (!Number.isFinite(day) || day < 1 || day > 7) return null;
    if (!Number.isFinite(startSection) || startSection < 1) return null;
    if (!Number.isFinite(duration) || duration < 1) return null;
    if (weeks.length === 0) return null;

    return {
        name: String(row.Kcm || "").trim(),
        teacher: String(row.Jsm || "").trim(),
        position: normalizePosition(row),
        day,
        startSection,
        endSection: startSection + duration - 1,
        weeks,
    };
}

async function fetchScheduleRows() {
    const token = getRequestVerificationToken();
    const form = new URLSearchParams();

    form.append("pagination[conditionJson]", JSON.stringify({
        zxjxjhh: "",
        isshowllkb: "1",
        isshowsykb: "1",
    }));
    form.append("pagination[sort]", "kch,kxh,skzc desc,skxq,skjc");
    form.append("pagination[order]", "desc");

    if (token) {
        form.append("__RequestVerificationToken", token);
    }

    const response = await fetch("/Tresources/A1Xskb/GetXsKb", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: form.toString(),
    });

    if (!response.ok) {
        throw new Error(`课表请求失败: ${response.status}`);
    }

    const json = await response.json();
    if (!json || !Array.isArray(json.rows)) {
        throw new Error("课表响应格式不正确");
    }

    return json.rows;
}

async function runImport() {
    const confirmed = await window.AndroidBridgePromise.showAlert(
        "太原理工大学课表导入",
        "请先确认你已经登录教务系统，并进入学生课表页面。当前脚本将导入课程数据，不包含作息时间和开学日期。",
        "开始导入"
    );

    if (!confirmed) {
        AndroidBridge.showToast("已取消导入");
        return;
    }

    AndroidBridge.showToast("正在获取课表数据...");
    const rows = await fetchScheduleRows();

    const courses = rows
        .map(toCourse)
        .filter(Boolean);

    if (courses.length === 0) {
        AndroidBridge.showToast("没有解析到可导入课程");
        return;
    }

    await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(courses));
    AndroidBridge.showToast(`导入成功，共 ${courses.length} 门课程`);
    AndroidBridge.notifyTaskCompletion();
}

runImport().catch(error => {
    console.error("TYUT import failed", error);
    AndroidBridge.showToast(`导入失败: ${error.message}`);
});
