import dbConn from "../database/db.config.js";

async function newTicket(req, res) {
  //todo : add data validation middleware for incoming data
  // this controller assumes the data is valid! and ok!
  let tempConn;
  try {
    const { sub, desc, priority } = req.body;
  } catch (error) {
    if (tempConn) {
      tempConn.rollback();
    }

    console.log("CONTROLLER ERROR : customer controller {newTicket}", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}
