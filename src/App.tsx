import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ── Pages ───────────────────────────────────────────────────────────────
import Home from "./components/pages/Home";
import Login from "./components/pages/Login";
import Onboarding from "./components/pages/Onboarding";

// ── Management ───────────────────────────────────────────────────────────────
import Management_Layout from "./components/management/layout/Management_Layout";
import Management_Overview from "./components/management/layout/Management_Overview";
import Invoice_Authorized_Person from "./components/management/categories/Invoice_Authorized_Person";
import Invoice_Bank_Details from "./components/management/categories/Invoice_Bank_Details";
import Leads from "./components/management/Leads";
import Department from "./components/management/categories/Department";
import Team_Access from "./components/management/categories/Team_Access";
import Invoice_Company_Address from "./components/management/categories/Invoice_Company_Address";
import Ads_Formats from "./components/management/categories/Ads_Formats";
import Metrics from "./components/management/categories/Metrics";
import Mode_Of_Payment from "./components/management/categories/Mode_Of_Payment";
import Payment_Terms from "./components/management/categories/Payment_Terms";
import Ethnicity from "./components/management/categories/Ethnicity";

// ── Account Manager ───────────────────────────────────────────────────────────────
import AccountManager_Layout from "./components/account_manager/layout/AccountManager_Layout";
import AccountManager_Overview from "./components/account_manager/layout/AccountManager_Overview";
import Leads_Account_Manager from "./components/account_manager/Leads_Account_Manager";
import Campaign_Create_Leads from "./components/account_manager/Campaign_Create_Leads";
import Image_Creatives_Campaign from "./components/account_manager/Image_Creatives_Campaign";
import Video_Creatives_Campaign from "./components/account_manager/Video_Creatives_Campaign";
import All_Campaigns from "./components/account_manager/All_Campaigns";

// ── Creative Team ───────────────────────────────────────────────────────────────
import CreativeTeam_Layout from "./components/creative_team/layout/CreativeTeam_Layout";
import CreativeTeam_Overview from "./components/creative_team/layout/CreativeTeam_Overview";
import Creative_Campaigns from "./components/creative_team/Creative_Campaigns";

// ── Campaign Team ───────────────────────────────────────────────────────────────
import CampaignTeam_Layout from "./components/campaign_team/layout/CampaignTeam_Layout";
import CampaignTeam_Overview from "./components/campaign_team/layout/CampaignTeam_Overview";
import Image_Creatives from "./components/creative_team/creatives/Image_Creatives";
import Video_Creatives from "./components/creative_team/creatives/Video_Creatives";
import Completed_Users from "./components/management/status/Completed_Users";
import Overdue_Users from "./components/management/status/Overdue_Users";
import My_Completed_Tasks from "./components/creative_team/status/My_Completed_Tasks";
import My_Incompleted_Tasks from "./components/creative_team/status/My_Incompleted_Tasks";
import Campaign_Campaigns from "./components/campaign_team/Campaign_Campaigns";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        {/* Pages */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Management */}
        <Route path="/management" element={<Management_Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Management_Overview />} />
          <Route path="categories/invoice_authorized_person" element={<Invoice_Authorized_Person />} />
          <Route path="categories/invoice_bank_details" element={<Invoice_Bank_Details />} />
          <Route path="categories/departments" element={<Department />} />
          <Route path="categories/teamaccess" element={<Team_Access />} />
          <Route path="categories/invoice_company_address" element={<Invoice_Company_Address />} />
          <Route path="categories/ads_formats" element={<Ads_Formats />} />
          <Route path="categories/metrics" element={<Metrics />} />
          <Route path="categories/mode_of_payment" element={<Mode_Of_Payment />} />
          <Route path="categories/payment_terms" element={<Payment_Terms />} />
          <Route path="categories/ethnicity" element={<Ethnicity />} />
          <Route path="leads" element={<Leads />} />
          <Route path="status/completed_users" element={<Completed_Users />} />
          <Route path="status/overdue_users" element={<Overdue_Users />} />

        </Route>

        {/* Account Manager */}
        <Route path="/account_manager" element={<AccountManager_Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AccountManager_Overview/>} />
          <Route path="leads" element={<Leads_Account_Manager />} />
          <Route path="campaign_create_leads" element={<Campaign_Create_Leads />} />
          <Route path="creative_image_upload_campaign" element={<Image_Creatives_Campaign/>} />
          <Route path="creative_video_upload_campaign" element={<Video_Creatives_Campaign/>} />
          <Route path="campaigns" element={<All_Campaigns/>} />
          <Route path="status/completed_users" element={<Completed_Users />} />
          <Route path="status/overdue_users" element={<Overdue_Users />} />
        </Route>

        {/* Creative Team */}
        <Route path="/creative_team" element={<CreativeTeam_Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<CreativeTeam_Overview/>} />
          <Route path="campaigns" element={<Creative_Campaigns />} />
          <Route path="image_creative" element={<Image_Creatives />} />
          <Route path="video_creative" element={<Video_Creatives/>} />
          <Route path="status/completed" element={<My_Completed_Tasks/>} />
          <Route path="status/incompleted" element={<My_Incompleted_Tasks/>} />
        </Route>

        {/* Campaign Team */}
        <Route path="/campaign_team" element={<CampaignTeam_Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<CampaignTeam_Overview/>} />
          <Route path="campaigns" element={<Campaign_Campaigns />} />
          <Route path="status/completed" element={<My_Completed_Tasks/>} />
          <Route path="status/incompleted" element={<My_Incompleted_Tasks/>} />
        </Route>

      </Routes>
    </BrowserRouter>


  )
}

export default App
