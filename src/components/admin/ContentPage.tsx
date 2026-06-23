import React from "react";
import { useBootstrap, useUpdateCategories } from "../../services/queries";
import { ContentTab } from "../settings/ContentTab";

export const ContentPage: React.FC = () => {
  const { data } = useBootstrap();
  const updateCategories = useUpdateCategories();

  const categories = data?.categories ?? [];
  const faviconApi = data?.prefs.faviconApi;

  return (
    <ContentTab
      categories={categories}
      onUpdateCategories={(next) => updateCategories.mutate(next)}
      faviconApi={faviconApi}
    />
  );
};
