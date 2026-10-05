const APIS = {
    auth: {
        "login":"/api/v1/user/auth/login/",
    },
    menu_items: {
        "get":"/api/v1/resturant-menu/menu-item/",
        "post":"/api/v1/resturant-menu/menu-item/",
        "delete":(id) => `/api/v1/resturant-menu/menu-item/${id}/`,
    },
    menu_category: {
        "get":"/api/v1/resturant-menu/menu-category/",
        "post":"/api/v1/resturant-menu/menu-category/",
        "delete":(id) => `/api/v1/resturant-menu/menu-category/${id}/`,
    },
    room_facilities_categories: {
        "get":"/api/v1/room/room-facilities-categories/",
        "post":"/api/v1/room/room-facilities-categories/",
        "delete":(id) => `/api/v1/room/room-facilities-categories/${id}/`,
    },
    room_facilities_items: {
        "get":"/api/v1/room/room-facilities-items/",
        "post":"/api/v1/room/room-facilities-items/",
        "delete":(id) => `/api/v1/room/room-facilities-items/${id}/`,
    },
    room_type: {
        "get":"/api/v1/room/room-type/",
        "post":"/api/v1/room/room-type/",
        "delete":(id) => `/api/v1/room/room-type/${id}/`,
    },
    rooms: {
        "get":"/api/v1/room/rooms/",
        "post":"/api/v1/room/rooms/",
        "delete":(id) => `/api/v1/room/rooms/${id}/`,
    },
    floors: {
        "get":"/api/v1/room/floors/",
        "post":"/api/v1/room/floors/",
        "delete":(id) => `/api/v1/room/floors/${id}/`,
    },
    room_image: {
        "get":"/api/v1/room/room-image/",
        "post":"/api/v1/room/room-image/",
        "delete":(id) => `/api/v1/room/room-image/${id}/`,
    },
    facilities: {
        "get":"/api/v1/facilities/facilities/",
        "post":"/api/v1/facilities/facilities/",
        "delete":(id) => `/api/v1/facilities/facilities/${id}/`,
    },
    gallery_category: {
        "get":"/api/v1/gallery/gallery-category/",
        "post":"/api/v1/gallery/gallery-category/",
        "delete":(id) => `/api/v1/gallery/gallery-category/${id}/`,
    },
    gallery_images: {
        "get":"/api/v1/gallery/gallery-image/",
        "post":"/api/v1/gallery/gallery-image/",
        "delete":(id) => `/api/v1/gallery/gallery-image/${id}/`,
    },
    awards_and_recognition: {
        "get":"/api/v1/home-page/awards-and-recognition/",
        "post":"/api/v1/home-page/awards-and-recognition/",
        "delete":(id) => `/api/v1/home-page/awards-and-recognition/${id}/`,
    },
    testimonials: {
        "get":"/api/v1/home-page/testemonail/",
        "post":"/api/v1/home-page/testemonail/",
        "delete":(id) => `/api/v1/home-page/testemonail/${id}/`,
    },
    benefits: {
        "get":"/api/v1/home-page/benefits/",
        "post":"/api/v1/home-page/benefits/",
        "delete":(id) => `/api/v1/home-page/benefits/${id}/`,
    },
    leadership: {
        "get":"/api/v1/aboutus/teams/",
        "post":"/api/v1/aboutus/teams/",
        "delete":(id) => `/api/v1/aboutus/teams/${id}/`,
    },
    core_values: {
        "get":"/api/v1/aboutus/core-values/",
        "post":"/api/v1/aboutus/core-values/",
        "delete":(id) => `/api/v1/aboutus/core-values/${id}/`,
    },
    facilities_home_page: {
        "get":"/api/v1/home-page/facilities-home-page/",
        "post":"/api/v1/home-page/facilities-home-page/",
        "delete":(id) => `/api/v1/home-page/facilities-home-page/${id}/`,
    }
}

export { APIS }