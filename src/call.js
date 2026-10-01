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

const isImageField = (key, value) =>
  /image/i.test(key) && typeof value === "string" && value.length > 0;

const toRequestBody = async (record) => {
  const imageFields = Object.entries(record).filter(([key, value]) =>
    isImageField(key, value),
  );

  if (imageFields.length === 0) {
    return record;
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (isImageField(key, value)) {
      const response = await fetch(value);
      if (!response.ok) {
        throw new Error(`Could not load image ${value}: ${response.status}`);
      }

      const filename = value.split("/").pop() || `${key}.bin`;
      formData.append(key, await response.blob(), filename);
    } else if (Array.isArray(value) || (value && typeof value === "object")) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }

  return formData;
};

const automateFunction = async (backendUrl, forwardedHost) => {
  const baseUrl = backendUrl.trim().replace(/\/+$/, "");
  const menuItemRecords = Object.entries(menuItems).flatMap(
    ([, items], index) =>
      items.map((item) => ({ ...item, category: index + 1 })),
  );
  const galleryImageRecords = Object.entries(galleryImages).flatMap(
    ([, images], index) =>
      images.map((image) => ({ ...image, category: index + 1 })),
  );
  const roomImageRecords = rooms.map((room, index) => ({
    room: index + 1,
    image: room.main_image,
  }));
  const endpointRecords = [
    [APIS.menu_category.post, menuCategories],
    [APIS.menu_items.post, menuItemRecords],
    [APIS.room_facilities_categories.post, roomFacilityCategories],
    [APIS.room_facilities_items.post, roomFacilityItems],
    [APIS.room_type.post, roomTypes],
    [APIS.floors.post, floors],
    [APIS.rooms.post, rooms],
    [APIS.room_image.post, roomImageRecords],
    [APIS.facilities.post, facilitiesPage],
    [APIS.facilities_home_page.post, facilities],
    [APIS.gallery_category.post, galleryCategories],
    [APIS.gallery_images.post, galleryImageRecords],
    [APIS.awards_and_recognition.post, awards],
    [APIS.benefits.post, benefits],
    [APIS.testimonials.post, testimonials],
  ];
  const result = { posted: 0, failures: [], skipped: [] };

  for (const [endpoint, records] of endpointRecords) {
    if (records.length === 0) {
      result.skipped.push(endpoint);
      continue;
    }

    for (const record of records) {
      console.log(baseUrl);

      try {
        console.log(`https://${baseUrl}${endpoint}`, "record");
          const body = await toRequestBody(record);

          await axios.post(`https://${baseUrl}${endpoint}`, body, {
          headers: {
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkxMDE4MTk2LCJpYXQiOjE3OTA4NDUzOTYsImp0aSI6IjkwYjA3YmUwMDI2MDQyYzZhOTAxOWVhNDI0MTJiYzFiIiwidXNlcl9pZCI6IjEifQ.3bhikVHSG9BopL5OIhzUzoSYzSIYW2eLJn-pv03lod4`,
            "x-forwarded-host":
              forwardedHost || "templates-api.hamroyouthit.com",
            "x-tenant-domain":
              forwardedHost || "templates-api.hamroyouthit.com",
          },
        });
        result.posted += 1;
      } catch (error) {
        result.failures.push({
          endpoint,
          record,
          message: error.response?.data?.detail || error.message,
        });
      }
    }
  }

  return result;
};

export default automateFunction;
