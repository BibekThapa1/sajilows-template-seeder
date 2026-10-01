import axios from "axios"
import mockData from "./mock"
import {APIS} from "../../apis/api"

const call = async (backendUrl) => {
    try {
        // For gallery
        for (const award of mockData) {
            await axios.post(`${backendUrl}${APIS.awards_and_recognition.post}`, award)
        }
        console.log("Gallery data filled successfully")
    }
    catch (error) {
        console.log(error);
    }
}

export default call