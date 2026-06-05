const o=`<div>
<style type="text/css">
    @import url(https://themes.googleusercontent.com/fonts/css?kit=10JVD_humAd5zP2yrFqw6vesZW2xOQ-xsNqO47m55DA);


    .c7 {
        margin-left: -27pt;
        padding-top: 0pt;
        padding-bottom: 0pt;
        line-height: 1.15;
        orphans: 2;
        widows: 2;
        text-align: left;
        height: 11pt
    }

    .c8 {
        margin-left: -4.5pt;
        padding-top: 0pt;
        padding-bottom: 0pt;
        line-height: 1.15;
        orphans: 2;
        widows: 2;
        text-align: left;
        height: 11pt
    }

    .c0 {
        color: #000000;
        font-weight: 400;
        text-decoration: none;
        vertical-align: baseline;
        font-size: 18pt;
        font-family: "Indie Flower";
        font-style: normal
    }

    .c6 {
        color: #000000;
        font-weight: 400;
        text-decoration: none;
        vertical-align: baseline;
        font-size: 19pt;
        font-family: "Indie Flower";
        font-style: normal
    }

    .c3 {
        color: #000000;
        font-weight: 400;
        text-decoration: none;
        vertical-align: baseline;
        font-size: 15pt;
        font-family: "Indie Flower";
        font-style: normal
    }

    .c5 {
        color: #000000;
        font-weight: 400;
        text-decoration: none;
        vertical-align: baseline;
        font-size: 6pt;
        font-family: "Indie Flower";
        font-style: normal
    }

    .c2 {
        margin-left: -4.5pt;
        padding-top: 0pt;
        padding-bottom: 0pt;
        line-height: 1.0;
        page-break-after: avoid;
        text-align: left
    }

    .c1 {
        margin-left: 229.5pt;
        padding-top: 0pt;
        padding-bottom: 0pt;
        line-height: 1.0;
        text-align: left
    }

    .c4 {
        background-color: #ffffff;
        max-width: 626pt;
        padding: 29pt 29pt 29pt 29pt
    }
</style>
<div class="c4 doc-content">
    <p class="c2"><span class="c0">{{firstname}} {{lastname}}</span></p>
    <p class="c2"><span class="c0">{{address1}}</span></p>
    <p class="c2"><span class="c0">{{address2}}</span></p>
    <p class="c8"><span class="c3"></span></p>
    <p class="c7"><span class="c5"></span></p>
    <p class="c1"><span class="c6">{{ba1}}</span></p>
</div>
</div>`,t=`
<style>
.ium {
    background-color: yellow !important;
  }
  
  .mmm {
    color: #ff0000 !important;
    font-family: none;
  }
  
span.transunion {
  background-color: #00A6CA;
  color: #fff !important;
}

span.experian {
  background-color: #1d4f91;
  color: #fff !important;
}

span.equifax {
  background-color: #981e32;
  color: #fff !important;
}

.l-transunion {
  background-color: #e4f1f5 !important;
  // color: #000000 !important;
}

.l-experian {
  background-color: #ecf4ff !important;
  // color: #fff !important;
}

.l-equifax {
  background-color: #f7edef !important;
  // color: #fff !important;
}

.Text_Bold1pixBigger {
  font-weight: bold;
  font-size: 13px;
  color: #0066cc;
  line-height: normal;
}

.bodyText {
  font-size: 12px;
  color: #000000;
  line-height: normal;
}

.i1 {
  padding-left: 15px;
}

.member_alert_score_review_bg {
  /* background-image: url("images/TU/member_alter_score_review_bg.png"); */
  background-repeat: repeat-x;
  border: 1px solid #adc6ee;
  border-radius: 5px;
  float: left;
  padding: 0;
  /*min-height: 153px;*/
  width: 342px;
}

.member_alert_score_bg {
  background: #dedfdf none repeat scroll 0 0;
  border: 1px solid #9da7b1;
  border-radius: 3px;
  float: left;
  font-size: 28px;
  font-weight: bold;
  height: 36px;
  line-height: 23px;
  padding-top: 10px;
  text-align: center;
  width: 85px;
  font-family: "Trebuchet MS", Arial, Helvetica, sans-serif;
}

.pageHeaderNoMargin {
  font-size: 24px;
  line-height: 24px;
  vertical-align: bottom;
  color: #009966;
  font-style: normal;
  font-weight: normal;
  border: 0px;
  margin: 0px;
  padding: 0px;
}



.disclaimerSmall {
  font-size: 10px;
  color: #666666;
}

.disclaimerSmallColour {
  font-size: 10px;
  color: #043737;
}


.disclaimer {
  font-weight: normal;
  font-size: 10px;
  font-style: normal;
  font-family: Verdana, arial, geneva, sans-serif;
  color: #333333;
}



.errorText {
  font-size: 11px;
  color: #CC0000;
  font-weight: bold;
}

.header {
  background-color: #009966;
}


.progressHeader {
  background-color: #009966;
}


.firstNav {
  color: #666666;
  background-color: #FFFFFF;
}

.firstNavLink:visited {
  color: #666666;
}

.contentBorder {
  background-color: #CCCCCC;
}

.faqHeader {
  color: #000000;
  background-color: #DDDDDD;
  font-weight: bold;
  font-size: 11px;
}

.faqBody {
  color: #006633;
  background-color: #EEEEEE;
  font-size: 11px;
}

.content {
  position: absolute;
  vertical-align: top;
  horizontal-align: left;
  width: 100%;
  height: 100%;
}

.formHeader {
  font-size: 10px;
  color: #FFFFFF;
  background-color: #818286;
  font-weight: bold;
  padding: 2px;
}

.formBody {
  font-size: 11px;
  color: #000000;
  background-color: #DDDDDD;
  font-weight: normal;
  padding: 0px;
}

.receiptTotal {
  font-size: 11px;
  font-weight: normal;
  padding: 0px;
}

.submitBody {
  font-size: 11px;
  color: #000000;
  background-color: #CBCBCB;
  font-weight: normal;
  padding: 0px;
}


.bodyText {
  font-size: 12px;
  color: #000000;
  background-color: #FFFFFF;
  font-weight: normal;
  padding: 0px;
}

.bodyTextScore {
  font-size: 8.3pt;
  color: #000000;
  background-color: #FFFFFF;
  font-family: Verdana, Arial, Helvetica, sans-serif;
  font-weight: normal;
  padding: 0px;
}



.homeBody {
  font-size: 12px;
  color: #009966;
  background-color: #E4EFE4;
  font-weight: normal;
  padding: 0px;
}

.darkGreyComment {
  font-size: 11px;
  color: #818286;
  font-weight: normal;
  padding: 0px;
}

.lightGreyComment {
  font-size: 11px;
  color: #CBCBCB;
  font-weight: normal;
  padding: 0px;
}

.darkGreyCommentOnBlue {
  color: #818286;
  background-color: #D1E6F2;
  font-weight: normal;
  font-size: 11px;
  padding: 0px;
}

.darkBlueHeaderOnBlue {
  color: #003366;
  background-color: #D1E6F2;
  font-weight: bold;
  padding: 0px;
}

.subH1Comment {
  color: #009966;
  background-color: #FFFFFF;
  font-weight: normal;
  padding: 0px;
  font-size: 11px;
}

.suberrH1Comment {
  color: #009966;
  background-color: #FFFFFF;
  font-weight: normal;
  padding: 0px;
  font-size: 11px;
}

.crTableBackground {
  background-color: #EEEEEE;
  font-size: 11px;
}


.crTableBackgroundLight {
  background-color: #EEEEEE;
  font-size: 11px;
}

.contentLarge {
  color: #333333;
  font-size: 10pt;
}

.reportAvailableText {
  font-size: 13px;
}

.pageHeading1GreyScale {
  color: #818286;
  font-size: 12pt;
  font-weight: bold;
}

.crGrantedTradelineHeader {
  color: #003498;
  background-color: #DDDDDD;
  font-size: 11px;
  font-weight: bold;
}

.crTradelineHeader {
  background-color: #EEEEEE;
  font-size: 11px;
}

.crTradelineGroupHeader {
  color: #000000;
  font-size: 13px;
  padding: 5px;
  background-color: #fefeda;
  width: 550px;
}


.crTableBackgroundSmall {
  background-color: #DDDDDD;
  font-size: 10px;
}


.crTableBackgroundVerySmall {
  background-color: #DDDDDD;
  font-size: 11px;
}

.crDarkGreenText {
  color: #006633;
}

.crDarkGreenText:visited {
  color: #006633;
}

.crDarkGreenText:active {
  color: #006633;
}

.crDarkGreenText:link {
  color: #006633;
}


.crTableHeader {
  background-color: #eeeeee;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 11px;
}

.alertTableHeader {
  background-color: #868686;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 11px;
}

.scoreTableHeader {
  background-color: #4884da;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 11px;
}

.singleScoreTableHeader {
  background-color: #4a86de;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 10px;
}

.crTab {
  background-color: #DDDDDD;
  color: #000000;
  font-size: 12px;
}

.crTabScore {
  background-color: #ffffff;
  color: #2765bf;
  font-size: 11px;
}

.bodyTextDesc {
  font-size: 10px;
  color: #000000;
  font-weight: bold;
  padding: 0px;
}

.bodyTextBoldAlertDesc {
  font-size: 10px;
  color: #000000;
  font-weight: bold;
  padding: 0px;
}

.crLightTableBackground {
  background-color: #FFFFFF;
  font-size: 11px;
}

.alertLightTableBackground {
  background-color: #EEEEEE;
  font-size: 11px;
}

.scoreLightTableBackground {
  background-color: #EEEEEE;
  font-size: 11px;
}

.crRoseLightTableBackground {
  background-color: #F7F3F7;
  font-size: 11px;
}

.largeMaintenanceText {
  font-size: 24px;
  line-height: 24px;
  color: #000000;
  font-style: normal;
  font-weight: bold;
  border: 0px;
  margin: 0px;
  padding: 0px;
  padding-bottom: 5px;
}

.bodyTextU {
  font-weight: normal;
  font-size: 75%;
  border-bottom: black 1px solid;
}

.topHeaderGreyComment {
  padding-left: 14px;
  font-weight: bold;
  font-size: 1.25em;
  color: #9c9c9c;
}

.topHeaderGreyComment1 {
  font-weight: bold;
  font-size: 1.00em;
  color: #9c9c9c;
}

.borderColor {
  border-color: #9c9c9c;
}

.crNameText {
  color: #5280b1;
  font-size: 18px;
}

.crThreeScoreBottomText {
  font-size: 12px;
  color: #999999;
  background-color: #FFFFFF;
  font-weight: normal;
  padding: 0px;
}

.bottomBodyText {
  font-size: 12px;
  color: #000000;
  background-color: #FFFFFF;
  font-weight: normal;
  padding: 6px;
}

A.bcLinkAlert:active {
  color: #5280b1;
  text-decoration: underline;
  font-size: 4px;
}

.bodyTextBoldAlert {
  font-weight: bold;
  font-size: 75%;
  padding-left: 5px;
}

.pageTitleAlertPopup {
  font-weight: bold;
  font-size: 1.25em;
  color: #999999;
}

.logOutHeading {
  font-size: 18px;
}

.logOutText {
  font-size: 12px;
}

.crTableBackgroundForPrint {
  background-color: #FFFFFF;
  font-size: 11px;
}

.crLightTableBackgroundForPrint {
  background-color: #FFFFFF;
  font-size: 11px;
}

.crTableBackgroundLightForPrint {
  background-color: #FFFFFF;
  font-size: 11px;
}

.crTradelineHeaderForPrint {
  background-color: #FFFFFF;
  font-size: 11px;
}

.crTradelineGroupHeaderForPrint {
  font-size: 12px;
  color: #000000;
  padding: 5px;
}

.RmediumForPrint {
  background-color: #FFFFFF;
  font-weight: bold;
  font-size: 11px;
}

.RSmallForPrint {
  background-color: #FFFFFF;
  font-size: 11px;
}

.reportSubTitle {
  font-size: 28px;
}

.idLikeTo {
  font-size: 11px;
  list-style: none;
  margin: 0;
  padding: 0 0 0 0;
}

.tranunionHeaderColum {
  color: #FFFFFF;
  font-size: 11px;
  font-weight: bold;
  background-color: #4d917b;
  padding-left: 5px;
}

.experianHeaderColum {
  color: #FFFFFF;
  font-size: 11px;
  font-weight: bold;
  background-color: #044993;
  padding-left: 5px;
}

.equifaxHeaderColum {
  color: #FFFFFF;
  font-size: 11px;
  font-weight: bold;
  background-color: #971d31;
  padding-left: 5px;
}

.whiteText {
  color: #FFFFFF;
  font-weight: bold;
}

.tranUnionText {
  color: #4D917B;
  font-weight: bold;
  font-size: 12px;
}

.experianText {
  color: #044993;
  font-weight: bold;
  font-size: 12px;
}

.equifaxText {
  color: #971D31;
  font-weight: bold;
  font-size: 12px;
}

.sectionHeader {
  font-size: 17px;
  color: #369BCD;
}

.accountHeader {
  color: #0066FF;
  font-weight: bold;
  font-size: 12px;
}

.moreAboutLink {
  float: right;
  font-size: 11px;
}

tr.table_headers {
  background: white url(https://www.myfreescorenow.com/TU/images/table_headers_bg.gif) bottom left repeat-x;
  color: #FFFFFF;
  margin: 0 0 0 0;
  padding: 0;
  font-size: 17px;
  font-weight: bold;
}

.tableborder {
  border: 2px solid green;
}

.inquiriesHeader {
  background-color: #cccccc;
  font-weight: bold;
  font-size: 11px;
  color: #000000;
}

.accountHistoryColorRow {
  background-color: #eeeeee;
  color: #000000;
  font-weight: bold;
  font-size: 11px;
}

.alertColHeader {
  color: #0066FF;
  font-weight: bold;
  font-size: 10px;
}

.crNoTableBackground {
  font-size: 12px;
}

.backtoTopText {
  float: right;
  font-size: 11px;
  color: #000000;
}

.score_table_headers {
  background: white url(https://www.myfreescorenow.com/TU/images/table_headers_bg.gif) bottom left repeat-x;
  color: #FFFFFF;
  margin: 0 0 0 0;
  padding: 0;
  font-weight: bold;
}

.score_sectionHeader {
  color: #369BCD;
  font-weight: bold;
  font-size: 12px;
}

.crWhiteTradelineHeader {
  color: #003498;
  background: white url(https://www.myfreescorenow.com/TU/images/table_headers_bg.gif) bottom left repeat-x;
  background-color: #FFFFFF;
  font-size: 11px;
  font-weight: bold;
  margin: 0 0 0 0;
  padding: 0;
}

.paymenttranUnionText {
  color: #4D917B;
  font-weight: bold;
  font-size: 10px;
}

.paymentexperianText {
  color: #044993;
  font-weight: bold;
  font-size: 10px;
}

.paymentequifaxText {
  color: #971D31;
  font-weight: bold;
  font-size: 10px;
}

.crNoColorTableHeader {
  background-color: #eeeeee;
  font-weight: bold;
  font-size: 11px;
}

.bodyTextBoldCSm {
  font-weight: bold;
  font-size: 11px;
}

.expHeader {
  background-color: #191970;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 17px;
}

.eqfHeader {
  background-color: #8B0000;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 17px;
}

.tuHeader {
  background-color: #4d917b;
  color: #FFFFFF;
  font-weight: bold;
  font-size: 17px;
}

.tuAlertHearder {
  color: #000000;
  font-weight: bold;
  background-color: #eee3c5;
  font-size: 12px;
  padding: 5px;
}

.tuAlertText {
  color: #000000;
  background-color: #f6f3e2;
  font-size: 12px;
}

.contentMedium {
  color: #000000;
  font-weight: bold;
  font-size: 12px;
}

.contentSmall {
  color: #000000;
  font-size: 12px;
}

/**Custom Style 
*/
table.tbl-tu-report {
  width: 100%;
}

table.tbl-tu-borderd {
  border: 1px solid #eeeeee;
}

.padding-left-right-5 {
  padding-left: 5px;
  padding-right: 5px;
}

.title-padding {
  padding: 2px 5px;
}

/*--------------------------------*/
div.rpt_fullReport_header {
  color: #ffffff;
  background-color: #3b4751;
  text-align: left;
  font-family: inherit !important;
  font-size: 1.2em;
  font-weight: bold;
  padding: 14px 10px;
  margin: 10px 0px 0px 0px;
}

.sub_header {
  color: #ffffff;
  background-color: #3b4751;
  text-align: left;
  font-size: 90%;
  /*small;*/
  font-weight: bold;
  padding: 8px;
  vertical-align: middle;
  line-height: 19px;
  clear: both;
}

.return_topSpan {
  float: right;
  font-size: 85%;
  color: white;
}

.return_topSpan img {
  border-width: 0px;
  border-style: none;
  margin-right: 5px;
  vertical-align: middle;
  margin-top: -3px;
  max-width: 15px;
  max-height: 15px;
}

.return_topSpan a {
  text-decoration: underline;
  font-weight: bold;
  color: white;
}

div.rpt_content_wrapper {
  /*font-family: Sans-Serif;*/
  font-weight: normal;
  font-size: small;
  color: #000000;
  /*padding: 10px;*/
}

table.rpt_content_table {
  border-left: solid 1px #cccccc;
  border-right: solid 1px #cccccc;
  table-layout: fixed;
  border-bottom: solid 1px #cccccc;
  width: 100%;
  border-collapse: collapse;
  background-color: White;
}

table.rpt_table4column th,
table.rpt_table4column td {
  width: 25%;
}

td.leftHeader {
  width: 70px;
}

table.rpt_content_header th {
  color: #ffffff;
  font-weight: bold;
  text-align: center;
  font-size: 90%;
}

table.rpt_content_header td {
}

th.headerTUC {
  background-color: #00A6CA;
}

th.headerEXP {
  background-color: #1d4f91;
}

th.headerEQF {
  background-color: #981e32;
}

td.headerTUC {
  background-color: #00A6CA !important;
  color: #fff !important;
}

td.headerEXP {
  background-color: #1d4f91 !important;
  color: #fff !important;
}

td.headerEQF {
  background-color: #981e32 !important;
  color: #fff !important;
}

td.label {
  color: #000000;
  font-weight: bold;
  text-align: right;
  padding-right: 15px !important;
  font-size: 85%;
}

td.info {
  color: #000000;
  font-weight: bold;
  text-align: center;
  font-size: 85%;
}

td.rowAlt,
tr.rowAlt {
  background-color: #eaf1f5;
}

table.rpt_table4column tr:nth-child(odd) {
  background-color: #fff;
}

table.rpt_table4column tr:nth-child(even) {
  background-color: #eaf1f5;
}

table.rpt_table4column tr:nth-child(even) td:nth-child(2),
table.rpt_table4column tr:nth-child(even) td:nth-child(3),
table.rpt_table4column tr:nth-child(even) td:nth-child(4) {
  background-color: #e4f1f5;
}

table.rpt_table4column tr:nth-child(even) td:nth-child(5),
table.rpt_table4column tr:nth-child(even) td:nth-child(6),
table.rpt_table4column tr:nth-child(even) td:nth-child(7) {
  background-color: #ecf4ff;
}

table.rpt_table4column tr:nth-child(even) td:nth-child(8),
table.rpt_table4column tr:nth-child(even) td:nth-child(9),
table.rpt_table4column tr:nth-child(even) td:nth-child(10) {
  background-color: #f7edef;
}

div.content_divider {
  height: 50px;
}

.tranUnionClr {
  color: #00A6CA !important;
}

.experianClr {
  color: #1d4f91 !important;
}

.equifaxClr {
  color: #981e32 !important;
}

.hstry_subtitle {
  background-color: #ddd;
  padding: 5px 6px;
  border: solid 1px #ddd;
  font-size: 85%;
}

table.addr_hsrty {
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  background-color: White;
}

table.addr_hsrty td.info {
  border: solid 1px #cccccc;
  font-weight: bold;
  text-align: center;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  padding-left: 0px;
  padding-right: 0px;
}

.hstry-header {
  padding: 10px 5px;
  font-weight: bold;
  border: solid 1px #cccccc;
  border-top-width: 0px;
  font-size: 85%;
}

.hstry-header-2yr {
  border-top-width: 0px;
}

.hstry-header-2yr img {
  float: right;
  margin-right: 5px;
  cursor: pointer;
  width: 65px;
  vertical-align: middle;
  margin-top: -1px;
}

.hstry-unknown {
  background-color: #DEDEDE !important;
}

.hstry-no-data-provided {
  background-color: white !important;
}

.hstry-ok {
  background-color: green !important;
  color: black;
  color: #fff !important;
}

.hstry-30 {
  background-color: #e29119 !important;
  color: white !important;
}

.hstry-60 {
  background-color: #E27904 !important;
  color: white !important;
}

.hstry-90 {
  background-color: #EA650C !important;
  color: white !important;
}

.hstry-120 {
  background-color: #EA3C00 !important;
  color: white !important;
}

.hstry-150 {
  background-color: #F21800 !important;
  color: white !important;
}

.hstry-160 {
  background-color: red !important;
  color: white !important;
}

.hstry-other {
  background-color: #000 !important;
  color: white !important;
}

.hstry-year {
  background-color: #f1f1f1;
  font-weight: bold;
}

.hstry-divider {
  height: 20px;
}

.outer-border {
  border: solid 1px #ccc;
  padding: 0px 5px;
}

table.rpt_content_header th.tbheader {
  background-color: #218b90;
  font-weight: bold;
  color: #fff;
}

.reportTopHeader {
  font-size: large;
  font-weight: bold;
  text-align: center;
  font-family: inherit !important;
  color: #5C5C5C;
  clear: both;
}

table.reportTop_content {
  /**/
  color: #5C5C5C;
  width: 100%;
  border-collapse: collapse;
  padding: 0px;
  border-spacing: 0px;
  font-size: 1.2em;
}

table.reportTop_content td {
  padding: 5px 0px 5px 0px;
  font-size: 85%;
}

table.rpt_content_contacts th,
table.rpt_content_contacts td {
  text-align: left !important;
}

.link_header {
  text-align: right;
  padding-right: 15px;
  padding-bottom: 15px;
}

.link_header img {
  border-width: 0px;
  border-style: none;
  margin-right: 5px;
  vertical-align: text-bottom;
  padding: 2px 10px 0 10px;
}

.link_header a {
  color: #3F8DB4;
  text-decoration: underline;
  font-weight: bold;
  /**/
  font-size: 90%;
}

table.help_text {
  /* background-color: #ccc; */
  border-collapse: collapse;
  /* color: #fff; */
  font-size: 12px;
  width: 100%;
  border-left: solid 1px #ccc;
  border-right: solid 1px #ccc;
  /*border-left: solid 1px #ddd;
    border-right: solid 1px #ddd;*/
}

table.help_text td {
  padding-bottom: 15px;
  padding-top: 15px;
  text-align: left;
}

.help_text_img {
  padding-left: 10px;
  width: 34px;
  border: none;
  padding-right: 10px;
}

.footer_content {
  text-align: right;
  padding-top: 15px;
  padding-right: 15px;
  padding-bottom: 10px;
  border-left: solid 1px #cccccc;
  border-right: solid 1px #cccccc;
  border-bottom: solid 1px #cccccc;
}

div.legend {
  position: absolute;
  width: 510px;
  background: white;
  z-index: 100;
  border: solid 1px #cccccc;
  top: 0px;
  left: 0px;
  font-size: 85%;
  display: none;
}

div.legend .header {
  background: #346699;
  color: white;
  padding: 10px;
  /*  */
  /* font-size: 100%; */
  font-weight: bold;
  width: 100%;
  float: left;
  /* font-size: 85%; */
}

div.legend .header a {
  float: right;
  margin-right: 6px;
  cursor: pointer;
  color: White;
  text-decoration: none;
}

div.legend .infoSection {
  background: white;
  color: black;
  padding: 0px 0px 0px 0px;
  /*  */
  font-weight: bold;
  width: 100%;
  float: left;
  line-height: 14px;
}

table.legendInfo {
  /*  */
  font-weight: normal;
  margin: 5px;
  width: 100%;
  border-spacing: 2px;
  font-size: 0.9em;
}

table.legendInfo td.clr {
  text-align: center;
  width: 20px;
  border: solid 1px black;
  font-weight: lighter;
}

table.legendInfo td.desc {
  padding-left: 3px;
  width: 180px;
  vertical-align: top;
}

.clear {
  clear: both;
}

.extra_info td.tuc_header {
  width: 25%;
  background: #00A6CA;
  color: #fff;
  text-align: right !important;
  /*font-size: 85%;*/
}

.extra_info td.exp_header {
  width: 25%;
  background: #1d4f91;
  color: #fff;
  text-align: right !important;
  /*font-size: 85%;*/
}

.extra_info td.eqf_header {
  width: 25%;
  background: #981e32;
  color: #fff;
  text-align: right !important;
  /*font-size: 85%;*/
}

div.descriptionTxt {
  line-height: 16px;
  font-weight: normal;
}

.subtitle-cnt {
  float: left;
}

.header-mismatch-img {
  float: left;
  margin-top: -2px;
  margin-left: 5px;
}

tr.data-mismatch td,
tr.data-mismatch td.info {
  background-color: #f3d49b !important;
}

td.data-mismatch {
  color: #fb0303 !important;
}

.err-fa-stack-1x {
  color: white;
}

.err-fa-stack-2x {
  font-size: 1.5em !important;
}

.err-fa-stack {
  width: 1.5em !important;
  height: 1.5em !important;
  line-height: 17px !important;
  vertical-align: middle !important;
}

.info-icon {
  color: #316dc1;
}

.helptext-icon {
  content: "?";
  color: #fff;
  font-size: 1.2em;
  border-radius: 50%;
  background: #CBDBE5;
  /* padding: 5px; */
  display: inline-block;
  width: 23px;
  height: 23px;
  text-align: center;
  padding: 2px;
  line-height: 20px;
  font-weight: bold;
}

#divReprtOuter * {
  font-family: inherit !important;
}

.clearfloat {
  clear: both;
}

.loader {
  font-size: 1em;
}

@media print {
  .main {
    max-width: 100% !important;
  }

  .column_33_percent {
    width: 0% !important;
    display: none;
  }

  .column_66_percent {
    width: 100% !important;
  }

  .menu>ul>li:not(.logo) {
    display: none !important;
  }
}

@media screen and (max-width:568px) {
  div.legend {
    width: 100%;
    left: 0 !important;
  }

  td.info {
    word-break: break-word;
  }
  
  td {
    height: 20px !important;
  }
}
</style>
`;export{t as css,o as envelove};
