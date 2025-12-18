import React from "react";
import { MessageSquare, GraduationCap, MonitorPlay } from "lucide-react";

const MODULES = [
    { id: "Chat", icon: MessageSquare },
    { id: "Training", icon: GraduationCap },
    { id: "Live Demo", icon: MonitorPlay },
];

const TopHeader = ({
    activeTab,
    setActiveTab,
    isLoading,
    setInput,
    onResetToolOutputs,
    setActiveThreadId,
    onTabNavigate,
}) => {

    const handleModuleChange = (tab) => {
        if (isLoading) return;
        setActiveTab(tab);
        setInput("");
        if (typeof onResetToolOutputs === "function") {
            onResetToolOutputs();
        }
        setActiveThreadId(null);
        if (typeof onTabNavigate === "function") {
            onTabNavigate(tab);
        }
    };

    return (
        <header className="flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/85 px-6 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-lg transition-colors md:flex-row md:items-center md:justify-between">

            {/* LEFT SIDE */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center text-2xl font-semibold tracking-tight text-slate-100">
                        <span className="text-slate-100">TAS</span>
                        <span className="mx-1 flex items-center" aria-hidden="true">
                            <span className="inline-block h-3 w-3 rounded-full bg-[var(--brand)]" />
                        </span>
                        <span className="text-slate-400">connect</span>
                    </div>
                </div>

                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    Powered by <span className="text-slate-100">Eerly.Ai</span>
                </p>
            </div>

            {/* RIGHT SIDE MODULE BUTTONS */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1.5 shadow-inner">
                {MODULES.map(({ id, icon: Icon }) => {
                    const isActive = activeTab === id;

                    return (
                        <button
                            key={id}
                            onClick={() => handleModuleChange(id)}
                            disabled={isLoading}
                            className={
                                `flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition ` +
                                (isActive
                                    ? "bg-gradient-to-br from-slate-800 via-sky-600 to-indigo-500 text-white shadow-lg shadow-sky-900/40"
                                    : "bg-slate-900/60 hover:text-sky-300")
                            }
                        >
                            <Icon size={18} />
                        </button>
                    );
                })}
            </div>

        </header>
    );
};

export default TopHeader;
