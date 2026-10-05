import axios from "axios";
import { APIS } from "./apis/api.js";
import menuItems from "./mock/resturant_menus/menu_items/mock.js";
import menuCategories from "./mock/resturant_menus/menu_category/mock.js";
import roomFacilityCategories from "./mock/rooms/room-facilities-category/mock.js";
import roomFacilityItems from "./mock/rooms/room-facilities-items/mock.js";
import roomTypes from "./mock/rooms/room-type/mock.js";
import rooms from "./mock/rooms/rooms/mock.js";
import floors from "./mock/rooms/room-floor/mock.js";
import facilities from "./mock/facilities/mock.js";
import facilitiesPage from "./mock/facilities-page/mock.js";
import galleryCategories from "./mock/gallery/gallery-category/mock.js";
import galleryImages from "./mock/gallery/gallery-images/mock.js";
import awards from "./mock/awards_and_recognition/mock.js";
import testimonials from "./mock/testemonials/mock.js";
import benefits from "./mock/benefits/mock.js";
import leadership from "./mock/leadership/mock.js";
import coreValues from "./mock/core-values/mock.js";

const isImageField = (key, value) =>
  /image/i.test(key) && typeof value === "string" && value.length > 0;

const toRequestBody = async (record) => {
  if (!Object.entries(record).some(([key, value]) => isImageField(key, value))) return record;

  const formData = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (isImageField(key, value)) {
      const response = await fetch(value);
      if (!response.ok) throw new Error(`Could not load image ${value}: ${response.status}`);
      formData.append(key, await response.blob(), value.split("/").pop() || `${key}.bin`);
    } else if ((key === "facilities" || key === "menu_items") && Array.isArray(value)) {
      for (const id of value) {
        formData.append(key, String(id));
      }
    } else if (Array.isArray(value) || (value && typeof value === "object")) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
};

const normalizeBaseUrl = (backendUrl) => {
  const inputUrl = backendUrl.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
};

const normalizeTenantHost = (forwardedHost, baseUrl) => {
  const tenantHost = forwardedHost
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0];
  return tenantHost || new URL(baseUrl).host;
};

export const authorize = async (backendUrl, loginEndpoint, email, password, forwardedHost) => {
  const baseUrl = normalizeBaseUrl(backendUrl);
  const tenantHost = normalizeTenantHost(forwardedHost, baseUrl);
  const response = await axios.post(
    new URL(loginEndpoint, `${baseUrl}/`).toString(),
    { email, password },
    { headers: { "x-forwarded-host": tenantHost, "x-tenant-domain": tenantHost } },
  );
  const payload = response.data?.data ?? response.data;
  const accessToken = payload?.access;
  if (!accessToken) {
    throw new Error(payload?.message || "Login response did not contain an access token.");
  }
  return { accessToken, user: payload.user, client: payload.client };
};

const automateFunction = async (backendUrl, forwardedHost, accessToken, onProgress) => {
  const baseUrl = normalizeBaseUrl(backendUrl);
  const tenantHost = normalizeTenantHost(forwardedHost, baseUrl);
  const requestConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-forwarded-host": tenantHost,
      "x-tenant-domain": tenantHost,
    },
  };
  const requestUrl = (endpoint) => new URL(endpoint, `${baseUrl}/`).toString();
  const result = { posted: 0, failures: [], blockers: [], fallbacks: [], skipped: [], endpointResults: [] };
  const notify = (event) => onProgress?.(event);
  const identity = (record) => record.name ?? record.title ?? record.room_number?.toString();

  const endpointSummary = (endpoint) => {
    let summary = result.endpointResults.find((item) => item.endpoint === endpoint);
    if (!summary) {
      summary = { endpoint, attempted: 0, posted: 0, failed: 0, skipped: 0 };
      result.endpointResults.push(summary);
    }
    return summary;
  };

  const getId = (value) => {
    if (!value || typeof value !== "object") return undefined;
    for (const key of ["id", "pk", "uuid"]) {
      if (value[key] !== undefined && value[key] !== null) return value[key];
    }
    for (const key of ["data", "result", "item", "record"]) {
      const id = getId(value[key]);
      if (id !== undefined) return id;
    }
    return undefined;
  };

  const extractRecords = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    for (const key of ["results", "data", "items", "records"]) {
      const records = extractRecords(value[key]);
      if (records.length) return records;
    }
    return [];
  };

  const getEndpoint = (postEndpoint) =>
    Object.values(APIS).find((api) => api.post === postEndpoint)?.get ?? postEndpoint;
  const errorDetails = (error) => {
    const data = error.response?.data;
    let message = data?.detail ?? data?.message ?? data;
    if (message && typeof message !== "string") message = JSON.stringify(message);
    return {
      status: error.response?.status,
      message: message || error.message || "Request failed without an error message",
    };
  };

  const collectionCache = new Map();
  const fetchAllRecords = async (postEndpoint, refresh = false) => {
    if (!refresh && collectionCache.has(postEndpoint)) return collectionCache.get(postEndpoint);
    const records = [];
    let url = requestUrl(getEndpoint(postEndpoint));
    let pageCount = 0;
    try {
      while (url && pageCount < 100) {
        const response = await axios.get(url, requestConfig);
        records.push(...extractRecords(response.data));
        url = response.data?.next ? new URL(response.data.next, url).toString() : null;
        pageCount += 1;
      }
      collectionCache.set(postEndpoint, records);
    } catch (error) {
      const details = errorDetails(error);
      result.failures.push({ endpoint: getEndpoint(postEndpoint), method: "GET", ...details });
      notify({ type: "request-failure", endpoint: getEndpoint(postEndpoint), method: "GET", ...details });
      collectionCache.set(postEndpoint, []);
    }
    return collectionCache.get(postEndpoint);
  };

  const randomId = (records) => {
    const ids = records.map(getId).filter((id) => id !== undefined);
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : undefined;
  };

  const selectRelatedIds = (records) => {
    const ids = [...new Set(records.map(getId).filter((id) => id !== undefined))];
    const maximum = Math.min(10, ids.length);
    const minimum = Math.min(3, maximum);
    const count = minimum + Math.floor((1 - Math.random() ** 2) * (maximum - minimum + 1));
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    return ids.slice(0, count);
  };

  const postRecords = async (endpoint, records, skipReason = "No eligible records to send.") => {
    const idByName = new Map();
    const unresolved = new Set();
    const summary = endpointSummary(endpoint);
    if (!records.length) {
      result.skipped.push({ endpoint, reason: skipReason });
      summary.skipped += 1;
      notify({ type: "endpoint-skipped", endpoint, reason: skipReason });
      return idByName;
    }

    notify({ type: "endpoint-start", endpoint, total: records.length });
    for (const record of records) {
      const name = identity(record) ?? "Unnamed record";
      summary.attempted += 1;
      try {
        const response = await axios.post(requestUrl(endpoint), await toRequestBody(record), requestConfig);
        result.posted += 1;
        summary.posted += 1;
        notify({ type: "request-success", endpoint, record: name, completed: summary.posted + summary.failed, total: records.length });
        const id = getId(response.data);
        if (id !== undefined && identity(record) !== undefined) idByName.set(identity(record), id);
        else if (identity(record) !== undefined) unresolved.add(identity(record));
      } catch (error) {
        const details = errorDetails(error);
        summary.failed += 1;
        result.failures.push({ endpoint, record: name, ...details });
        notify({ type: "request-failure", endpoint, record: name, ...details, completed: summary.posted + summary.failed, total: records.length });
        if (identity(record) !== undefined) unresolved.add(identity(record));
      }
    }

    if (unresolved.size) {
      try {
        const existing = await fetchAllRecords(endpoint);
        for (const saved of existing) {
          const name = identity(saved);
          const id = getId(saved);
          if (name !== undefined && id !== undefined && !idByName.has(name)) idByName.set(name, id);
        }
        for (const name of unresolved) {
          if (idByName.has(name)) {
            const fallback = {
              endpoint,
              record: name,
              id: idByName.get(name),
              message: `Using matching existing record ID ${idByName.get(name)} fetched from the backend.`,
            };
            result.fallbacks.push(fallback);
            notify({ type: "foreign-key-fallback", ...fallback });
            continue;
          }
          const id = randomId(existing);
          if (id === undefined) {
            const failure = { endpoint, method: "GET", record: name, message: "GET returned no records with IDs; no valid foreign key is available." };
            result.failures.push(failure);
            notify({ type: "request-failure", ...failure });
            continue;
          }
          idByName.set(name, id);
          const fallback = { endpoint, record: name, id, message: `Using randomly selected existing ID ${id} after resolving the collection with GET.` };
          result.fallbacks.push(fallback);
          notify({ type: "foreign-key-fallback", ...fallback });
        }
      } catch (error) {
        const details = errorDetails(error);
        result.failures.push({ endpoint, method: "GET", ...details, message: `Could not fetch existing records for foreign-key recovery: ${details.message}` });
        notify({ type: "request-failure", endpoint, method: "GET", ...details });
      }
    }
    notify({ type: "endpoint-complete", ...summary });
    return idByName;
  };

  const menuCategoryIds = await postRecords(APIS.menu_category.post, menuCategories);
  let existingMenuCategories = [];
  if (menuCategories.some(({ name }) => !menuCategoryIds.has(name))) {
    existingMenuCategories = await fetchAllRecords(APIS.menu_category.post);
  }
  const menuItemRecords = [];
  for (const [categoryName, items] of Object.entries(menuItems)) {
    const matching = existingMenuCategories.find((category) => category.name === categoryName);
    const categoryId = menuCategoryIds.get(categoryName) ?? getId(matching) ?? randomId(existingMenuCategories);
    if (categoryId === undefined) {
      result.failures.push({ endpoint: APIS.menu_items.post, record: categoryName, message: `GET returned no menu category IDs for ${categoryName}.` });
      continue;
    }
    if (!menuCategoryIds.has(categoryName)) {
      const fallback = { endpoint: APIS.menu_category.post, record: categoryName, id: categoryId, message: `Using existing menu category ID ${categoryId} after GET fallback.` };
      result.fallbacks.push(fallback);
      notify({ type: "foreign-key-fallback", ...fallback });
    }
    menuItemRecords.push(...items.map((item) => ({ ...item, category: categoryId })));
  }
  const menuItemIds = await postRecords(APIS.menu_items.post, menuItemRecords, "Menu items could not be built because no menu category IDs were available.");

  const roomFacilityCategoryIds = await postRecords(APIS.room_facilities_categories.post, roomFacilityCategories);
  const roomFacilityItemRecords = [];
  let existingRoomFacilityCategories = [];
  if (roomFacilityItems.some(({ category }) => !roomFacilityCategoryIds.has(category))) {
    existingRoomFacilityCategories = await fetchAllRecords(APIS.room_facilities_categories.post);
  }
  for (const item of roomFacilityItems) {
    let categoryId = roomFacilityCategoryIds.get(item.category);
    if (categoryId === undefined) {
      categoryId = getId(existingRoomFacilityCategories.find((category) => category.name === item.category)) ?? randomId(existingRoomFacilityCategories);
      if (categoryId !== undefined) {
        const fallback = { endpoint: APIS.room_facilities_categories.post, record: item.category, id: categoryId, message: `Using existing room-facility category ID ${categoryId} after GET fallback.` };
        result.fallbacks.push(fallback);
        notify({ type: "foreign-key-fallback", ...fallback });
      }
    }
    if (categoryId === undefined) {
      result.failures.push({ endpoint: APIS.room_facilities_items.post, record: item.name, message: `No category ID available for ${item.category}.` });
      continue;
    }
    roomFacilityItemRecords.push({ ...item, category: categoryId });
  }
  await postRecords(APIS.room_facilities_items.post, roomFacilityItemRecords, "Room-facility items could not be built because no category IDs were available.");

  const roomTypeIds = await postRecords(APIS.room_type.post, roomTypes);
  const floorIds = await postRecords(APIS.floors.post, floors);
  let existingRoomTypes = [];
  let existingFloors = [];
  if (rooms.some((room) => !roomTypeIds.has(room.room_type_name))) existingRoomTypes = await fetchAllRecords(APIS.room_type.post);
  if (rooms.some((room) => !floorIds.has(room.floor_name))) existingFloors = await fetchAllRecords(APIS.floors.post);
  const existingFacilityItems = await fetchAllRecords(APIS.room_facilities_items.post, true);
  const existingMenuItems = await fetchAllRecords(APIS.menu_items.post, true);
  const roomRecords = [];

  for (const room of rooms) {
    const roomTypeId = roomTypeIds.get(room.room_type_name) ?? getId(existingRoomTypes.find((item) => item.name === room.room_type_name)) ?? randomId(existingRoomTypes);
    const floorId = floorIds.get(room.floor_name) ?? getId(existingFloors.find((item) => item.name === room.floor_name)) ?? randomId(existingFloors);
    const facilityIds = selectRelatedIds(existingFacilityItems);
    const menuIds = selectRelatedIds([
      ...existingMenuItems,
      ...[...menuItemIds.values()].map((id) => ({ id })),
    ]);
    if (roomTypeId === undefined || floorId === undefined) {
      const missing = [roomTypeId === undefined && "room type", floorId === undefined && "floor"].filter(Boolean);
      result.failures.push({ endpoint: APIS.rooms.post, record: room.name, message: `No backend records with IDs were returned for: ${missing.join(", ")}.` });
      notify({ type: "dependency-blocked", endpoint: APIS.rooms.post, record: room.name, reason: `GET returned no valid ID for ${missing.join(", ")}.` });
      continue;
    }
    roomRecords.push({
      name: room.name,
      main_image: room.main_image,
      price: room.price,
      capacity: room.capacity,
      room_number: room.room_number,
      is_visible: room.is_visible,
      room_type: roomTypeId,
      floor: floorId,
      facilities: facilityIds,
      menu_items: menuIds,
    });
  }
  const roomIds = await postRecords(APIS.rooms.post, roomRecords, "Rooms were blocked because GET returned no usable related IDs.");
  let existingRooms = [];
  if (rooms.some((room) => !roomIds.has(room.name))) existingRooms = await fetchAllRecords(APIS.rooms.post);
  const roomImageRecords = rooms.flatMap((room) => {
    const roomId = roomIds.get(room.name) ?? getId(existingRooms.find((saved) => saved.name === room.name)) ?? randomId(existingRooms);
    return roomId === undefined ? [] : [{ room: roomId, image: room.main_image }];
  });
  await postRecords(APIS.room_image.post, roomImageRecords, "Room images were blocked because GET returned no room IDs.");

  await postRecords(APIS.facilities.post, facilitiesPage);
  await postRecords(APIS.facilities_home_page.post, facilities);

  const galleryCategoryIds = await postRecords(APIS.gallery_category.post, galleryCategories);
  let existingGalleryCategories = [];
  if (Object.keys(galleryImages).some((name) => !galleryCategoryIds.has(name))) {
    existingGalleryCategories = await fetchAllRecords(APIS.gallery_category.post);
  }
  const galleryImageRecords = Object.entries(galleryImages).flatMap(([categoryName, images]) => {
    const categoryId = galleryCategoryIds.get(categoryName) ?? getId(existingGalleryCategories.find((saved) => saved.name === categoryName)) ?? randomId(existingGalleryCategories);
    return categoryId === undefined ? [] : images.map((image) => ({ ...image, category: categoryId }));
  });
  await postRecords(APIS.gallery_images.post, galleryImageRecords, "Gallery images were blocked because GET returned no category IDs.");

  await postRecords(APIS.awards_and_recognition.post, awards);
  await postRecords(APIS.benefits.post, benefits);
  await postRecords(APIS.testimonials.post, testimonials);
  await postRecords(APIS.leadership.post, leadership);
  await postRecords(APIS.core_values.post, coreValues);
  return result;
};

export const deleteAllData = async (backendUrl, forwardedHost, accessToken, onProgress) => {
  const baseUrl = normalizeBaseUrl(backendUrl)
  const tenantHost = normalizeTenantHost(forwardedHost, baseUrl)
  const requestConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-forwarded-host': tenantHost,
      'x-tenant-domain': tenantHost,
    },
  }
  const requestUrl = (endpoint) => new URL(endpoint, `${baseUrl}/`).toString()
  const result = { deleted: 0, failures: [], endpointResults: [] }
  const notify = (event) => onProgress?.(event)
  const endpoints = [
    APIS.room_image,
    APIS.rooms,
    APIS.room_facilities_items,
    APIS.room_facilities_categories,
    APIS.menu_items,
    APIS.menu_category,
    APIS.gallery_images,
    APIS.gallery_category,
    APIS.facilities,
    APIS.facilities_home_page,
    APIS.awards_and_recognition,
    APIS.benefits,
    APIS.testimonials,
    APIS.leadership,
    APIS.core_values,
    APIS.room_type,
    APIS.floors,
  ]
  const extractRecords = (value) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) return child
      const found = extractRecords(child)
      if (found.length) return found
    }
    return []
  }
  const getRecordId = (record) => record?.id ?? record?.pk ?? record?.uuid
  const errorMessage = (error) => {
    const detail = error.response?.data?.detail ?? error.response?.data?.message ?? error.response?.data
    return typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message
  }

  for (const api of endpoints) {
    const endpoint = api.get
    const rows = []
    let url = requestUrl(api.get)
    let page = 0

    try {
      while (url && page < 100) {
        const response = await axios.get(url, requestConfig)
        rows.push(...extractRecords(response.data))
        url = response.data?.next ? new URL(response.data.next, url).toString() : null
        page += 1
      }
    } catch (error) {
      const failure = { endpoint, method: 'GET', message: errorMessage(error), status: error.response?.status }
      result.failures.push(failure)
      notify({ type: 'delete-failure', ...failure })
      continue
    }

    const summary = { endpoint, attempted: 0, deleted: 0, failed: 0 }
    result.endpointResults.push(summary)
    notify({ type: 'delete-start', endpoint, total: rows.length })

    if (rows.length === 0) {
      notify({
        type: 'delete-empty',
        endpoint,
        message: 'GET succeeded but returned no records in a recognized collection array.',
      })
    }

    for (const record of rows) {
      const id = getRecordId(record)
      if (id === undefined || id === null) {
        const failure = { endpoint, method: 'DELETE', record: record.name ?? record.title ?? 'Unknown record', message: 'Record has no id, pk, or uuid field.' }
        result.failures.push(failure)
        summary.failed += 1
        notify({ type: 'delete-failure', ...failure, completed: summary.deleted + summary.failed, total: rows.length })
        continue
      }

      summary.attempted += 1
      try {
        await axios.delete(requestUrl(api.delete(id)), requestConfig)
        summary.deleted += 1
        result.deleted += 1
        notify({
          type: 'delete-success',
          endpoint,
          record: record.name ?? record.title ?? String(id),
          id,
          completed: summary.deleted + summary.failed,
          total: rows.length,
        })
      } catch (error) {
        const failure = {
          endpoint,
          method: 'DELETE',
          record: record.name ?? record.title ?? String(id),
          id,
          message: errorMessage(error),
          status: error.response?.status,
        }
        result.failures.push(failure)
        summary.failed += 1
        notify({ type: 'delete-failure', ...failure, completed: summary.deleted + summary.failed, total: rows.length })
      }
    }

    notify({ type: 'delete-endpoint-complete', ...summary, total: rows.length })
  }

  return result
}

export default automateFunction;
