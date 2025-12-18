import React from "react";
import { Sparkles, MessageSquare, GraduationCap, MonitorPlay } from "lucide-react";

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
        <header className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white/90 px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-lg transition-colors md:flex-row md:items-center md:justify-between">

            {/* LEFT SIDE */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center text-2xl font-semibold tracking-tight text-black">
                        <span className="text-black">TAS</span>
                        <span className="mx-1 flex items-center" aria-hidden="true">
                            <span className="inline-block h-3 w-3 rounded-full bg-[var(--brand)]" />
                        </span>
                        <span className="text-zinc-700">connect</span>
                    </div>
                </div>

                {/* <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-zinc-500">
                    <Sparkles size={16} className="text-[var(--brand)]" />
                    Insight Engine
                </div>

                <h1 className="text-xl font-semibold text-black md:text-2xl">
                    Immersive Analysis Hub
                </h1>

                <p className="text-sm text-zinc-600">
                    Track every stage with live visual cues and interact using quick actions.
                </p> */}

                <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-500">
                    Powered by <span className="text-black">Eerly.Ai</span>
                </p>
            </div>

            {/* RIGHT SIDE MODULE BUTTONS */}
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                {MODULES.map(({ id, icon: Icon }) => {
                    const isActive = activeTab === id;

                    return (
                        <button
                            key={id}
                            onClick={() => handleModuleChange(id)}
                            disabled={isLoading}
                            className={
                                `flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 disabled:opacity-60 ` +
                                (isActive
                                    ? "border-transparent bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] text-white shadow-lg shadow-[0_18px_32px_rgba(242,60,57,0.3)]"
                                    : "border-transparent bg-white text-zinc-500 hover:border-[var(--brand-light)] hover:bg-[var(--brand-lighter)] hover:text-black")
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
