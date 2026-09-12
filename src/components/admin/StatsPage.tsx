import React, { useMemo } from "react";
import { BarChart3 } from "../../utils/icons";
import { useBootstrap } from "../../services/queries";
import { useLanguage } from "../../contexts/LanguageContext";
import { SettingsContainer, SettingsSection } from "../settings/SettingsPrimitives";

const StatCell: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="surface-hover rounded-xl px-3 py-2.5 border border-muted text-center">
    <div className="text-lg font-bold font-mono text-[var(--theme-primary)]">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{label}</div>
  </div>
);

export const StatsPage: React.FC = () => {
  const { t } = useLanguage();
  const { data } = useBootstrap();
  const categories = useMemo(() => data?.categories ?? [], [data]);

  const stats = useMemo(() => {
    const links = categories.flatMap((c) => c.subCategories.flatMap((s) => s.items));
    const visited = links.filter((l) => (l.visitCount ?? 0) > 0);
    const top = [...visited].sort((a, b) => (b.visitCount ?? 0) - (a.visitCount ?? 0)).slice(0, 10);
    return {
      categories: categories.length,
      subCategories: categories.reduce((n, c) => n + c.subCategories.length, 0),
      links: links.length,
      zeroClick: links.length - visited.length,
      top,
    };
  }, [categories]);

  return (
    <SettingsContainer>
      <SettingsSection icon={BarChart3} title={t("stats_title")} description={t("stats_desc")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCell label={t("stats_categories")} value={stats.categories} />
          <StatCell label={t("stats_subcategories")} value={stats.subCategories} />
          <StatCell label={t("stats_links")} value={stats.links} />
          <StatCell label={t("stats_zero_click")} value={stats.zeroClick} />
        </div>
        {stats.top.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
              {t("stats_top_visited")}
            </div>
            <div className="space-y-1">
              {stats.top.map((link, i) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg surface-hover"
                >
                  <span className="truncate text-secondary">
                    <span className="font-mono text-muted mr-2">{i + 1}.</span>
                    {link.title}
                  </span>
                  <span className="font-mono font-bold text-[var(--theme-primary)] shrink-0 ml-3">
                    {link.visitCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingsSection>
    </SettingsContainer>
  );
};

export default StatsPage;
