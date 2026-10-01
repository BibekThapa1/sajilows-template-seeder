import axios from "axios"
import mockData from "./mock"
import {APIS} from "../../apis/api"

const call = async (backendUrl) => {
    try {
        for (const facility of mockData) {
            await axios.post(`${backendUrl}${APIS.facilities_home_page.post}`, facility)
        }
    }
    catch (error) {
        console.log(error);
    }
}

export default call