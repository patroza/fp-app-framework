import { ReadContext } from "@fp-app/io.diskdb"
import { TrainTripView } from "../usecases/getTrainTrip"

const trainTripReadContext = new ReadContext<TrainTripView>("trainTrip")

export default trainTripReadContext
