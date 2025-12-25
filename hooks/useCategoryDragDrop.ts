import React, { useState, useRef } from "react";
import { Category } from "../types";

interface UseCategoryDragDropProps {
  categories: Category[];
  onUpdateCategories: (categories: Category[]) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  isAnyEditing: boolean;
  collapsedSubMenus: Set<string>;
  setCollapsedSubMenus: (ids: Set<string>) => void;
}

export const useCategoryDragDrop = ({
  categories,
  onUpdateCategories,
  selectedCategoryId,
  setSelectedCategoryId,
  isAnyEditing,
  collapsedSubMenus,
  setCollapsedSubMenus,
}: UseCategoryDragDropProps) => {
  // --- State ---
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<
    number | null
  >(null);
  const [dragOverCategoryIndex, setDragOverCategoryIndex] = useState<
    number | null
  >(null);

  const [draggedLink, setDraggedLink] = useState<{
    categoryId: string;
    subId: string;
    index: number;
  } | null>(null);
  const [dragOverLink, setDragOverLink] = useState<{
    subId: string;
    index: number;
  } | null>(null);
  const [dragOverSubMenuId, setDragOverSubMenuId] = useState<string | null>(
    null
  );

  const hoverSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // --- Logic ---

  const resetDragState = () => {
    setDraggedCategoryIndex(null);
    setDragOverCategoryIndex(null);
    setDraggedLink(null);
    setDragOverLink(null);
    setDragOverSubMenuId(null);
    if (hoverSwitchTimeoutRef.current) {
      clearTimeout(hoverSwitchTimeoutRef.current);
      hoverSwitchTimeoutRef.current = null;
    }
  };

  const handleDragStartCategory = (e: React.DragEvent, index: number) => {
    if (isAnyEditing) {
      e.preventDefault();
      return;
    }
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverCategory = (
    e: React.DragEvent,
    index: number,
    catId: string
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Category Reordering
    if (draggedCategoryIndex !== null && draggedCategoryIndex !== index) {
      setDragOverCategoryIndex(index);
    }

    // Link Dragging over Category (Tab Switching)
    if (draggedLink) {
      if (selectedCategoryId !== catId) {
        setDragOverCategoryIndex(index);
        if (!hoverSwitchTimeoutRef.current) {
          hoverSwitchTimeoutRef.current = setTimeout(() => {
            setSelectedCategoryId(catId);
            setDragOverCategoryIndex(null);
            hoverSwitchTimeoutRef.current = null;
          }, 600);
        }
      } else {
        if (hoverSwitchTimeoutRef.current) {
          clearTimeout(hoverSwitchTimeoutRef.current);
          hoverSwitchTimeoutRef.current = null;
        }
        setDragOverCategoryIndex(null);
      }
    }
  };

  const handleDragLeaveCategory = () => {
    if (hoverSwitchTimeoutRef.current) {
      clearTimeout(hoverSwitchTimeoutRef.current);
      hoverSwitchTimeoutRef.current = null;
    }
    setDragOverCategoryIndex(null);
  };

  const handleDropCategory = (
    e: React.DragEvent,
    targetIndex: number,
    targetCatId: string
  ) => {
    e.preventDefault();

    // Drop Category
    if (draggedCategoryIndex !== null) {
      if (draggedCategoryIndex === targetIndex) {
        resetDragState();
        return;
      }
      const updated = [...categories];
      const [moved] = updated.splice(draggedCategoryIndex, 1);
      updated.splice(targetIndex, 0, moved);
      onUpdateCategories(updated);
      resetDragState();
      return;
    }

    // Drop Link onto Category (Move Link to Default Submenu of Target Category)
    if (draggedLink) {
      const sourceCatId = draggedLink.categoryId;
      const newCategories = JSON.parse(
        JSON.stringify(categories)
      ) as Category[];
      const sourceCat = newCategories.find((c) => c.id === sourceCatId);
      const sourceSub = sourceCat?.subCategories.find(
        (s) => s.id === draggedLink.subId
      );

      if (!sourceCat || !sourceSub) {
        resetDragState();
        return;
      }

      const [movedItem] = sourceSub.items.splice(draggedLink.index, 1);
      const targetCat = newCategories.find((c) => c.id === targetCatId);

      if (targetCat && targetCat.subCategories.length > 0) {
        targetCat.subCategories[0].items.push(movedItem);
        onUpdateCategories(newCategories);
        setSelectedCategoryId(targetCatId);
      }
      resetDragState();
    }
  };

  const handleDragStartLink = (
    e: React.DragEvent,
    subId: string,
    index: number
  ) => {
    e.stopPropagation();
    if (isAnyEditing) {
      e.preventDefault();
      return;
    }
    setDraggedLink({ categoryId: selectedCategoryId, subId, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnterLink = (subId: string, index: number) => {
    if (
      draggedLink &&
      (draggedLink.subId !== subId || draggedLink.index !== index)
    ) {
      setDragOverLink({ subId, index });
    }
  };

  const handleDragOverSubMenu = (e: React.DragEvent, subId: string) => {
    if (!draggedLink) return;
    e.preventDefault();
    if (dragOverSubMenuId !== subId && draggedLink.subId !== subId) {
      setDragOverSubMenuId(subId);
    }
  };

  const handleDragLeaveSubMenu = () => {
    setDragOverSubMenuId(null);
  };

  const handleDropLinkToSubMenu = (e: React.DragEvent, targetSubId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLink) {
      resetDragState();
      return;
    }
    if (
      draggedLink.categoryId === selectedCategoryId &&
      draggedLink.subId === targetSubId
    ) {
      resetDragState();
      return;
    }

    const newCategories = JSON.parse(JSON.stringify(categories)) as Category[];
    const sourceCatIndex = newCategories.findIndex(
      (c) => c.id === draggedLink.categoryId
    );
    if (sourceCatIndex === -1) {
      resetDragState();
      return;
    }

    const sourceSubIndex = newCategories[
      sourceCatIndex
    ].subCategories.findIndex((s) => s.id === draggedLink.subId);
    if (sourceSubIndex === -1) {
      resetDragState();
      return;
    }

    const [movedItem] = newCategories[sourceCatIndex].subCategories[
      sourceSubIndex
    ].items.splice(draggedLink.index, 1);
    const targetCatIndex = newCategories.findIndex(
      (c) => c.id === selectedCategoryId
    );
    const targetSubIndex = newCategories[
      targetCatIndex
    ].subCategories.findIndex((s) => s.id === targetSubId);

    if (targetSubIndex === -1) {
      resetDragState();
      return;
    }

    newCategories[targetCatIndex].subCategories[targetSubIndex].items.push(
      movedItem
    );
    onUpdateCategories(newCategories);

    // Auto expand if collapsed
    if (collapsedSubMenus.has(targetSubId)) {
      const newCollapsed = new Set(collapsedSubMenus);
      newCollapsed.delete(targetSubId);
      setCollapsedSubMenus(newCollapsed);
    }
    resetDragState();
  };

  const handleDropLink = (
    e: React.DragEvent,
    targetSubId: string,
    targetIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLink) {
      resetDragState();
      return;
    }
    if (
      draggedLink.categoryId === selectedCategoryId &&
      draggedLink.subId === targetSubId &&
      draggedLink.index === targetIndex
    ) {
      resetDragState();
      return;
    }

    const newCategories = JSON.parse(JSON.stringify(categories)) as Category[];
    const sourceCatIndex = newCategories.findIndex(
      (c) => c.id === draggedLink.categoryId
    );
    if (sourceCatIndex === -1) {
      resetDragState();
      return;
    }

    const sourceSubIndex = newCategories[
      sourceCatIndex
    ].subCategories.findIndex((s) => s.id === draggedLink.subId);
    if (sourceSubIndex === -1) {
      resetDragState();
      return;
    }

    const [movedItem] = newCategories[sourceCatIndex].subCategories[
      sourceSubIndex
    ].items.splice(draggedLink.index, 1);
    const targetCatIndex = newCategories.findIndex(
      (c) => c.id === selectedCategoryId
    );
    const targetSubIndex = newCategories[
      targetCatIndex
    ].subCategories.findIndex((s) => s.id === targetSubId);

    if (targetSubIndex !== -1) {
      newCategories[targetCatIndex].subCategories[targetSubIndex].items.splice(
        targetIndex,
        0,
        movedItem
      );
      onUpdateCategories(newCategories);
    }
    resetDragState();
  };

  return {
    draggedCategoryIndex,
    dragOverCategoryIndex,
    draggedLink,
    dragOverLink,
    dragOverSubMenuId,
    handleDragStartCategory,
    handleDragOverCategory,
    handleDragLeaveCategory,
    handleDropCategory,
    handleDragStartLink,
    handleDragEnterLink,
    handleDragOverSubMenu,
    handleDragLeaveSubMenu,
    handleDropLinkToSubMenu,
    handleDropLink,
    resetDragState,
  };
};
