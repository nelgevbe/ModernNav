import { useState, useRef, useEffect } from "react";
import { Category, LinkItem, SubCategory } from "../../types";
import { useCategoryDragDrop } from "../../hooks/useCategoryDragDrop";
import { getFaviconUrl } from "../../utils/favicon";
import { useLanguage } from "../../contexts/LanguageContext";

type LinkFormData = Partial<LinkItem> & { subCategoryId: string };

export interface ContentEditorState {
  selectedCategoryId: string;
  searchQuery: string;
  collapsedSubMenus: Set<string>;
  isAddingCategory: boolean;
  newCategoryTitle: string;
  editingCategoryId: string | null;
  editCategoryTitle: string;
  isAddingSubMenu: boolean;
  newSubMenuTitle: string;
  editingSubMenuId: string | null;
  editSubMenuTitle: string;
  targetSubMenuId: string | null;
  editingLinkId: string | null;
  linkFormData: LinkFormData;
  showIconPicker: boolean;
  iconSearch: string;
  isAnyEditing: boolean;
  iconPickerRef: React.RefObject<HTMLDivElement>;
  iconGroupRef: React.RefObject<HTMLDivElement>;
}

export interface ContentEditorActions {
  setSelectedCategoryId: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setIsAddingCategory: (v: boolean | ((prev: boolean) => boolean)) => void;
  setNewCategoryTitle: (v: string) => void;
  setEditingCategoryId: (id: string | null) => void;
  setEditCategoryTitle: (v: string) => void;
  setIsAddingSubMenu: (v: boolean) => void;
  setNewSubMenuTitle: (v: string) => void;
  setEditingSubMenuId: (id: string | null) => void;
  setEditSubMenuTitle: (v: string) => void;
  setLinkFormData: (d: LinkFormData) => void;
  setShowIconPicker: (v: boolean) => void;
  setIconSearch: (v: string) => void;
  handleAddCategory: () => void;
  handleUpdateCategoryTitle: (id: string) => void;
  handleDeleteCategory: (id: string, name: string) => void;
  handleAddSubMenu: () => void;
  handleAddLinkDirectly: () => void;
  handleDeleteSubMenu: (subId: string, title: string) => void;
  handleUpdateSubMenuTitle: (subId: string) => void;
  toggleSubMenu: (subId: string) => void;
  openAddLink: (subId: string) => void;
  openEditLink: (subId: string, item: LinkItem) => void;
  handleSaveLink: () => void;
  handleDeleteLink: (subId: string, linkId: string) => void;
  closeLinkForm: () => void;
  dragHandlers: ReturnType<typeof useCategoryDragDrop>;
}

export function useContentEditor(
  categories: Category[],
  onUpdateCategories: (categories: Category[]) => void,
  faviconApi?: string
): { state: ContentEditorState; actions: ContentEditorActions } {
  const { t } = useLanguage();

  // --- UI State ---
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSubMenus, setCollapsedSubMenus] = useState<Set<string>>(new Set());

  // --- Category States ---
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryTitle, setEditCategoryTitle] = useState("");

  // --- SubMenu States ---
  const [isAddingSubMenu, setIsAddingSubMenu] = useState(false);
  const [newSubMenuTitle, setNewSubMenuTitle] = useState("");
  const [editingSubMenuId, setEditingSubMenuId] = useState<string | null>(null);
  const [editSubMenuTitle, setEditSubMenuTitle] = useState("");

  // --- Link Form States ---
  const [targetSubMenuId, setTargetSubMenuId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkFormData, setLinkFormData] = useState<LinkFormData>({
    title: "",
    url: "",
    description: "",
    icon: "",
    subCategoryId: "",
  });

  // --- Icon Picker State ---
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconGroupRef = useRef<HTMLDivElement>(null);

  const isAnyEditing =
    editingCategoryId !== null ||
    editingSubMenuId !== null ||
    targetSubMenuId !== null ||
    editingLinkId !== null ||
    isAddingCategory ||
    isAddingSubMenu;

  // --- Drag and Drop ---
  const dragHandlers = useCategoryDragDrop({
    categories,
    onUpdateCategories,
    selectedCategoryId,
    setSelectedCategoryId,
    isAnyEditing,
    collapsedSubMenus,
    setCollapsedSubMenus,
  });

  // --- Initial Selection ---
  const effectiveSelectedCategoryId = (() => {
    if (
      categories.length > 0 &&
      (!selectedCategoryId || !categories.find((c) => c.id === selectedCategoryId))
    ) {
      return categories[0].id;
    }
    return selectedCategoryId;
  })();

  if (effectiveSelectedCategoryId !== selectedCategoryId) {
    setSelectedCategoryId(effectiveSelectedCategoryId);
  }

  // --- Click Outside for Icon Picker ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsidePicker =
        iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node);
      const isOutsideGroup =
        iconGroupRef.current && !iconGroupRef.current.contains(event.target as Node);
      if (isOutsidePicker && isOutsideGroup) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---
  const closeLinkForm = () => {
    setTargetSubMenuId(null);
    setEditingLinkId(null);
    setLinkFormData({
      title: "",
      url: "",
      description: "",
      icon: "",
      subCategoryId: "",
    });
    setShowIconPicker(false);
  };

  const handleAddCategory = () => {
    if (!newCategoryTitle.trim()) return;
    const newCat: Category = {
      id: Date.now().toString(),
      title: newCategoryTitle,
      subCategories: [{ id: Date.now().toString() + "-gen", title: "Default", items: [] }],
    };
    onUpdateCategories([...categories, newCat]);
    setNewCategoryTitle("");
    setIsAddingCategory(false);
    setSelectedCategoryId(newCat.id);
  };

  const handleUpdateCategoryTitle = (id: string) => {
    if (!editCategoryTitle.trim()) {
      setEditingCategoryId(null);
      return;
    }
    onUpdateCategories(
      categories.map((c) => (c.id === id ? { ...c, title: editCategoryTitle } : c))
    );
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (window.confirm(t("delete_cat_confirm", { name }))) {
      const updated = categories.filter((c) => c.id !== id);
      onUpdateCategories(updated);
      if (selectedCategoryId === id && updated.length > 0) setSelectedCategoryId(updated[0].id);
    }
  };

  const handleAddSubMenu = () => {
    if (!newSubMenuTitle.trim() || !selectedCategoryId) return;
    const newSub: SubCategory = {
      id: Date.now().toString(),
      title: newSubMenuTitle,
      items: [],
    };
    onUpdateCategories(
      categories.map((c) =>
        c.id === selectedCategoryId ? { ...c, subCategories: [...c.subCategories, newSub] } : c
      )
    );
    setNewSubMenuTitle("");
    setIsAddingSubMenu(false);
  };

  const handleAddLinkDirectly = () => {
    if (!selectedCategoryId) return;
    const newSubId = Date.now().toString();
    const newSub: SubCategory = { id: newSubId, title: "Default", items: [] };
    onUpdateCategories(
      categories.map((c) =>
        c.id === selectedCategoryId ? { ...c, subCategories: [...c.subCategories, newSub] } : c
      )
    );
    setTargetSubMenuId(newSubId);
    setEditingLinkId(null);
    setLinkFormData({
      title: "",
      url: "",
      description: "",
      icon: "",
      subCategoryId: newSubId,
    });
  };

  const handleDeleteSubMenu = (subId: string, title: string) => {
    if (window.confirm(t("delete_submenu_confirm", { name: title }))) {
      onUpdateCategories(
        categories.map((c) =>
          c.id === selectedCategoryId
            ? {
                ...c,
                subCategories: c.subCategories.filter((s) => s.id !== subId),
              }
            : c
        )
      );
    }
  };

  const handleUpdateSubMenuTitle = (subId: string) => {
    if (!editSubMenuTitle.trim()) return;
    onUpdateCategories(
      categories.map((c) =>
        c.id === selectedCategoryId
          ? {
              ...c,
              subCategories: c.subCategories.map((s) =>
                s.id === subId ? { ...s, title: editSubMenuTitle } : s
              ),
            }
          : c
      )
    );
    setEditingSubMenuId(null);
  };

  const toggleSubMenu = (subId: string) => {
    const newSet = new Set(collapsedSubMenus);
    if (newSet.has(subId)) {
      newSet.delete(subId);
    } else {
      newSet.add(subId);
    }
    setCollapsedSubMenus(newSet);
  };

  const openAddLink = (subId: string) => {
    setTargetSubMenuId(subId);
    setEditingLinkId(null);
    setLinkFormData({
      title: "",
      url: "",
      description: "",
      icon: "",
      subCategoryId: subId,
    });
    setIconSearch("");
    setShowIconPicker(false);
    const newCollapsed = new Set(collapsedSubMenus);
    newCollapsed.delete(subId);
    setCollapsedSubMenus(newCollapsed);
  };

  const openEditLink = (subId: string, item: LinkItem) => {
    setTargetSubMenuId(subId);
    setEditingLinkId(item.id);
    setLinkFormData({
      title: item.title,
      url: item.url,
      description: item.description || "",
      icon: item.icon || "",
      subCategoryId: subId,
    });
    setIconSearch("");
    setShowIconPicker(false);
  };

  const handleSaveLink = () => {
    if (!linkFormData.title || !linkFormData.url || !selectedCategoryId || !targetSubMenuId) return;

    let finalIcon = linkFormData.icon;
    if (!finalIcon && linkFormData.url) {
      finalIcon = getFaviconUrl(linkFormData.url, faviconApi) || "Link";
    }

    const id = editingLinkId || `${Date.now()}`;
    const newItem: LinkItem = {
      id,
      title: linkFormData.title,
      url: linkFormData.url,
      description: linkFormData.description || "",
      icon: finalIcon || "Link",
    };

    onUpdateCategories(
      categories.map((cat) =>
        cat.id === selectedCategoryId
          ? {
              ...cat,
              subCategories: cat.subCategories.map((sub) => {
                if (sub.id === targetSubMenuId) {
                  return editingLinkId
                    ? {
                        ...sub,
                        items: sub.items.map((i) => (i.id === editingLinkId ? newItem : i)),
                      }
                    : { ...sub, items: [...sub.items, newItem] };
                }
                return sub;
              }),
            }
          : cat
      )
    );
    closeLinkForm();
  };

  const handleDeleteLink = (subId: string, linkId: string) => {
    if (window.confirm("Delete this link?")) {
      onUpdateCategories(
        categories.map((cat) =>
          cat.id === selectedCategoryId
            ? {
                ...cat,
                subCategories: cat.subCategories.map((sub) =>
                  sub.id === subId
                    ? {
                        ...sub,
                        items: sub.items.filter((i) => i.id !== linkId),
                      }
                    : sub
                ),
              }
            : cat
        )
      );
    }
  };

  return {
    state: {
      selectedCategoryId,
      searchQuery,
      collapsedSubMenus,
      isAddingCategory,
      newCategoryTitle,
      editingCategoryId,
      editCategoryTitle,
      isAddingSubMenu,
      newSubMenuTitle,
      editingSubMenuId,
      editSubMenuTitle,
      targetSubMenuId,
      editingLinkId,
      linkFormData,
      showIconPicker,
      iconSearch,
      isAnyEditing,
      iconPickerRef,
      iconGroupRef,
    },
    actions: {
      setSelectedCategoryId,
      setSearchQuery,
      setIsAddingCategory,
      setNewCategoryTitle,
      setEditingCategoryId,
      setEditCategoryTitle,
      setIsAddingSubMenu,
      setNewSubMenuTitle,
      setEditingSubMenuId,
      setEditSubMenuTitle,
      setLinkFormData,
      setShowIconPicker,
      setIconSearch,
      handleAddCategory,
      handleUpdateCategoryTitle,
      handleDeleteCategory,
      handleAddSubMenu,
      handleAddLinkDirectly,
      handleDeleteSubMenu,
      handleUpdateSubMenuTitle,
      toggleSubMenu,
      openAddLink,
      openEditLink,
      handleSaveLink,
      handleDeleteLink,
      closeLinkForm,
      dragHandlers,
    },
  };
}
