import type { HelpCatalogue, HelpChrome } from "./types";

/**
 * Hướng dẫn quy trình tiếng Việt cho ứng dụng web. Bản dịch bám sát `en.ts`: cùng các chủ đề,
 * cùng thứ tự, cùng số bước và số mục cần lưu ý. Tên menu và tên nút trong dấu ngoặc kép là chữ
 * hiển thị thật trên giao diện tiếng Việt (`src/messages/vi.json`), không phải bản dịch tự do.
 */
export const helpCatalogueVi: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Đăng nhập và tham gia công ty",
    purpose:
      "Folio cho bạn đăng nhập bằng số điện thoại và một mã gửi qua SMS — không có mật khẩu. Tài khoản của bạn phải thuộc về một công ty thì mới thấy được dữ liệu.",
    steps: [
      "Nhập số điện thoại ở trang đăng nhập rồi bấm “Gửi mã”.",
      "Nhập mã 6 số nhận được qua SMS để hoàn tất đăng nhập.",
      "Nếu tài khoản chưa thuộc công ty nào, Folio đưa bạn tới một trang thiết lập ngắn.",
      "Ở đó, hoặc bấm “Tạo công ty” — bạn thành quản trị viên của công ty đó — hoặc “Nhập mã tham gia” bằng mã quản trị viên đưa cho bạn.",
      "Nếu bạn được mời qua email, đường dẫn trong thư đó liên kết thẳng bạn vào công ty.",
    ],
    gotchas: [
      "Chỉ nhận số điện thoại Pháp, và bỏ số 0 đứng đầu.",
    ],
    whoCanDoIt: "Bất kỳ ai có số điện thoại đã được thêm vào một công ty.",
  },
  {
    id: "navigation",
    title: "Đi lại trong ứng dụng",
    purpose:
      "Mỗi lúc chỉ có một dự án được chọn, và gần như cả ứng dụng nói về dự án đó. Thanh bên chứa các mục của dự án; thanh trên cùng chứa các thao tác.",
    steps: [
      "Chọn công trình đang làm ở bộ chọn dự án trên đầu thanh bên. Trên màn hình hẹp, bộ chọn nằm ở thanh trên cùng.",
      "Nhóm đầu tiên của thanh bên dùng chung cho cả ứng dụng: “Tổng quan”, “Dự án” và “Thư viện”.",
      "Khi đã chọn một dự án, thanh bên hiện thêm các mục: “Kế hoạch”, “Nhân công”, “Chi phí”, “Hoạch toán”, “Thành viên”, “Ghi chú”, “Tài liệu” và “Phân tích”.",
      "Quản trị viên công ty còn thấy nhóm “Báo giá & Hóa đơn”: “Báo giá”, “Hóa đơn”, “Mẫu tài liệu” và “Hoàn tiền”.",
      "Thanh trên cùng chứa thao tác chính của trang, dấu trợ giúp, chuông thông báo, nút chuyển sáng tối, bộ chọn ngôn ngữ và menu tài khoản của bạn.",
    ],
    whoCanDoIt:
      "Ai cũng thấy nhóm dùng chung. “Tài liệu” chỉ hiện nếu bạn được phép mở, còn nhóm “Báo giá & Hóa đơn” chỉ dành cho quản trị viên công ty.",
    gotchas: [
      "Nút hành động trên thanh trên cùng thay đổi theo từng trang, và nó bị ẩn hẳn nếu bạn không có quyền tương ứng: nếu bạn chờ “Chi phí mới” hay “Chấm ngày” mà không thấy, đó là do quyền chứ không phải lỗi.",
    ],
  },
  {
    id: "dashboard",
    title: "Tổng quan dự án",
    purpose:
      "Bức tranh chỉ để xem của công trình đang chọn: tháng này đã chi bao nhiêu, tín dụng ngân hàng đã rút tới đâu, chi tiêu theo loại trong sáu tháng, và việc của tuần này.",
    steps: [
      "Chọn một dự án trước — chưa chọn thì các ô đều trống.",
      "Đọc ô “Đã chi tháng này” và phần ngân sách mà con số đó chiếm.",
      "Xem biểu đồ “Giải ngân tín dụng ngân hàng”. Nếu chưa ghi nhận khoản tín dụng nào, ô này hiện “Mở cài đặt dự án” thay thế.",
      "Dùng “Chi tiêu hàng tháng theo loại” để biết tiền đi đâu, và “Chi phí” để mở sổ chi phí.",
      "Đọc “Tuần này” để thấy việc đến hạn, việc quá hạn có dấu riêng, và “Lịch trình” để mở Kế hoạch.",
    ],
    whoCanDoIt:
      "Bất kỳ ai đã đăng nhập. Nửa phần tài chính — biểu đồ tín dụng ngân hàng và các con số so với ngân sách — cần quyền xem ngân sách; không có quyền thì phần đó đơn giản là không được vẽ ra.",
    gotchas: ["“Tổng quan” cố ý chỉ để xem và không có nút thao tác riêng."],
  },
  {
    id: "projects",
    title: "Dự án và cài đặt dự án",
    purpose:
      "Mọi công trình bạn thấy được, kèm tín dụng và chi tiêu, đội ngũ của nó, và các biểu mẫu để tạo, sửa hoặc xóa một dự án.",
    steps: [
      "Lọc danh sách bằng hai nút “Tất cả” và “Đang chạy”, hoặc tìm theo tên.",
      "Bấm “Tạo dự án”, đặt tên — bắt buộc — và nếu muốn thì thêm địa chỉ, tổng tín dụng và nguồn tài trợ. Nếu bạn quản trị nhiều công ty, chọn công ty mà dự án thuộc về.",
      "Trên thẻ dự án, menu thao tác có “Sửa dự án” và “Xóa dự án”. Khi xóa, bạn phải gõ lại đúng chữ in đậm hiện trên màn hình.",
      "“Hiện đội ngũ” mở danh sách thành viên; “Mời” thêm người, và biểu tượng thùng rác ở mỗi dòng xóa họ đi.",
      "“Mở tổng quan” chọn dự án đó rồi mở trang tổng quan của nó; “Phương tiện” mở ảnh và video.",
      "Trong trang cài đặt dự án, đặt tín dụng ngân hàng và nguồn tài trợ, đặt tiền tố số hóa đơn, rồi lưu.",
    ],
    whoCanDoIt:
      "Tạo dự án cần quyền quản trị công ty. Sửa cần quyền chỉnh sửa dự án, còn xóa thì chỉ quản trị viên mới làm được. Mời và xóa thành viên cần quyền quản lý thành viên. Các cột tín dụng và còn lại cần quyền xem ngân sách.",
    gotchas: [
      "Trang cài đặt dự án rất khó tới: lối vào duy nhất là “Mở cài đặt dự án” trong biểu đồ tín dụng ngân hàng, mà liên kết đó biến mất ngay khi đã ghi nhận một khoản tín dụng.",
      "Người không có quyền tạo dự án và chưa được giao dự án nào sẽ thấy thông báo “Chờ quản lý thêm bạn vào công trình” chứ không phải lời mời tạo dự án.",
    ],
  },
  {
    id: "planning",
    title: "Công việc và kế hoạch",
    purpose:
      "Bảng việc của đội cho một công trình: một bảng Kanban kèm backlog, cùng một chế độ xem theo tuần sắp theo ngày đến hạn.",
    steps: [
      "Chuyển giữa “Bảng” và “Tuần” bằng nút gạt ở trên cùng.",
      "Trên bảng, làm việc với dải backlog và các cột “Cần làm”, “Đang làm”, “Bị chặn” và “Xong”.",
      "Bấm “Thêm task” trong cột nào để tạo việc ngay ở đó: tiêu đề, mô tả, độ ưu tiên, hạn và các nhãn cách nhau bằng dấu phẩy.",
      "Kéo thẻ từ cột này sang cột khác để đổi trạng thái.",
      "Bấm vào một thẻ để mở bảng chi tiết, sửa ngay tại chỗ, hoặc xóa.",
      "Ở chế độ xem tuần, chuyển qua lại giữa các tuần và dùng nút “+” trên một ngày để tạo việc đến hạn ngày đó, hoặc nút “+” ở “Chưa lên lịch” cho việc chưa có hạn.",
    ],
    whoCanDoIt:
      "Bất kỳ ai mở được dự án. Kế hoạch không có rào quyền nào cả — ai cũng tạo, kéo, sửa và xóa task được.",
    gotchas: [
      "Xóa task có hiệu lực ngay và không hoàn tác được, chỉ có một hộp xác nhận của trình duyệt.",
    ],
  },
  {
    id: "labor",
    title: "Chấm công, công nhân và tiền lương",
    purpose:
      "Ai có mặt ở công trường, vào những ngày nào, với đơn giá ngày bao nhiêu, tốn bao nhiêu tiền, và thực tế đã trả cho từng công nhân bao nhiêu.",
    steps: [
      "Chọn một thẻ: “Tổng hợp”, “Chấm công”, “Công nhân” hoặc “Thanh toán”.",
      "Ở “Công nhân”, bấm “Thêm công nhân” rồi điền tên, số điện thoại, vai trò và lương ngày. Sau đó mỗi dòng có thể sửa, vô hiệu hóa, hoặc thêm một thay đổi mức lương.",
      "“Điều chỉnh mức lương” nhận mức lương ngày mới và ngày bắt đầu có hiệu lực; phần lịch sử bên dưới liệt kê và xóa các thay đổi đã lên lịch.",
      "Ở “Chấm công”, bấm “Chấm ngày”, chọn ngày, rồi tích những ai có mặt — có thể chép lại lựa chọn của ngày trước, và với từng người thì thêm giá ghi đè, ghi chú và giờ phụ.",
      "Ngày do công nhân tự chấm sẽ vào mục “Chờ duyệt” và chưa được tính tiền cho tới khi bạn bấm “Duyệt” hoặc “Từ chối”.",
      "Xuất dữ liệu chấm công của một công nhân hoặc của tất cả, theo khoảng tháng, ra file xlsx hoặc pdf.",
      "Ở “Thanh toán”, đối chiếu số phải trả với số đã trả cho từng công nhân, ghi nhận một khoản thanh toán, hoặc gán một chi phí nhân công chưa có công nhân nào.",
    ],
    whoCanDoIt:
      "Chấm ngày, sửa bản ghi và duyệt cần quyền quản lý nhân công. Ghi nhận thanh toán cần quyền quản lý hóa đơn. Người không có quyền nào trong số đó chỉ thấy “Danh sách chấm công trong ngày” — tên, trạng thái, số giờ và loại ngày công, không có con số tiền nào.",
    gotchas: [
      "Chấm lại một ngày mà công nhân đã tự chấm sẽ bị từ chối; hãy duyệt bản ghi đang chờ của họ thay vì thêm lại.",
    ],
  },
  {
    id: "invoices",
    title: "Sổ chi phí",
    purpose:
      "Từng đồng ra vào một công trình — chi phí nhà cung cấp, tiền trả nhân công, vốn ngân hàng giải ngân và hàng trả lại — kèm tệp đính kèm, màu đánh dấu và xuất file.",
    steps: [
      "Đọc phần tóm tắt hai túi tiền và biểu đồ tín dụng ngân hàng ở đầu trang.",
      "Lọc bằng các thẻ loại: tất cả, vốn giải ngân, nhân công, vật tư & dịch vụ, khác, hoặc trả hàng.",
      "Bấm “Chi phí mới” rồi chọn loại, ngày phát hành, người nhận — với chi phí nhân công thì ô này thành bộ chọn công nhân — phương thức thanh toán và ghi chú nếu có.",
      "Thêm các dòng mục với mô tả, số lượng, đơn giá và thuế suất TVA, rồi lưu.",
      "Với khoản trả hàng, chọn chi phí vật tư & dịch vụ được hoàn, cho biết đã hoàn bằng tiền mặt hay bằng avoir, và nếu là avoir thì chọn hóa đơn mà nó được áp dụng vào.",
      "Bấm một dòng để mở rộng: in hoặc lưu PDF, sửa, xóa, hoặc kéo tệp đính kèm thả vào.",
      "Xuất một khoảng tháng, lọc theo loại, ra xlsx hoặc pdf; và tô màu đánh dấu cho các dòng để gom nhóm bằng mắt.",
    ],
    whoCanDoIt:
      "Ai ở trong dự án cũng đọc và xuất được danh sách. Sửa, xóa, tô màu và mọi thứ bên trong một dòng đã mở rộng đều cần quyền quản lý hóa đơn. Không có quyền xem ngân sách thì hai túi tiền và biểu đồ ngân hàng bị ẩn, còn thẻ vốn giải ngân biến mất.",
    gotchas: [
      "Một khoản vốn giải ngân được đánh dấu là tạm ứng tiền mặt của công ty thì cố ý không tính vào vốn đã giải ngân. Những gì bạn mua bằng số tiền mặt đó phải ghi theo phương thức tiền mặt của bạn, nếu không sẽ bị tính hai lần.",
      "Những dòng do Folio tự sinh ra thì không bao giờ sửa hay xóa được.",
    ],
  },
  {
    id: "chiffrage",
    title: "Hoạch toán vật tư",
    purpose:
      "Lên danh sách những thứ cần mua cho công trình — các hạng mục gồm nhiều vật tư kèm số lượng — ghi giá của từng cửa hàng cho mỗi vật tư, và biết số tiền cần dự trù.",
    steps: [
      "Bấm “Hạng mục mới” và đặt tên theo nghề hoặc theo khu vực, ví dụ đèn chiếu sáng hay cấp thoát nước.",
      "Trong một hạng mục, thêm vật tư với tên, số lượng, đơn vị và phòng.",
      "Trên một vật tư, thêm báo giá: chọn cửa hàng — hoặc gõ tên rồi thêm ngay tại chỗ — rồi nhập đơn giá, cho biết giá đó chưa hay đã gồm thuế, thuế suất TVA, và liên kết sản phẩm nếu có.",
      "Mở rộng một vật tư để so các mức giá đã thu thập; mỗi mức được gắn nhãn “Đã chọn”, “Rẻ nhất”, hoặc “Tự động · rẻ nhất”. “Chọn” sẽ chốt mức giá dùng để dự trù.",
      "Dùng “So sánh” trên một hạng mục để đặt hai cửa hàng cạnh nhau và đọc chênh lệch theo từng mục và theo cả giỏ hàng.",
      "Đọc ô tổng để biết “Số tiền cần dự trù”, chưa thuế và đã gồm thuế, kèm cảnh báo khi còn vật tư chưa có giá.",
    ],
    whoCanDoIt:
      "Ai mở được dự án thì đọc được và dùng được phần so sánh. Tạo và sửa hạng mục, vật tư và báo giá cần quyền quản lý hóa đơn; không có quyền thì trang chỉ để xem.",
    gotchas: [
      "Cửa hàng chỉ có mỗi cái tên: không có chỗ nào ghi hay sửa địa chỉ và trang web của cửa hàng, cũng không xóa được cửa hàng.",
      "Giá được so sánh theo cửa hàng, nên lần nào cũng phải chọn đúng cửa hàng, nếu không phần so sánh sẽ âm thầm sai lệch.",
    ],
  },
  {
    id: "members",
    title: "Ai làm trong dự án này",
    purpose:
      "Ai đang ở trong công trình này và họ vào bằng đường nào: gán những người đã có trong công ty, mời người mới qua email, và xóa họ khỏi dự án.",
    steps: [
      "Bấm “Thêm thành viên vào dự án”, tìm trong danh bạ công ty theo tên hoặc số điện thoại, chọn vai trò, rồi thêm.",
      "Bấm “Mời thành viên” để gửi lời mời qua email. Người đã có tài khoản Folio được thêm thẳng vào; người chưa có sẽ nhận một đường dẫn có hiệu lực bảy ngày.",
      "Đọc bảng thành viên: tên, email và ngày tham gia.",
      "Dùng “Sửa” ở mỗi dòng để chỉnh tên hiển thị hoặc email, hoặc “Xóa” để bỏ ai đó khỏi dự án.",
      "Trong “Lời mời đang chờ”, xem ai chưa chấp nhận và thu hồi lời mời khi cần.",
    ],
    whoCanDoIt:
      "Thêm thành viên vào dự án cần quyền chỉnh sửa dự án, mời và thu hồi cần quyền mời, còn sửa hoặc xóa cần quyền quản lý thành viên. Chỉ quản trị viên công ty mới trao được vai trò “Quản lý”; quản lý chỉ gán được vai trò “Thành viên”.",
    gotchas: [
      "Không đổi được vai trò dự án từ “Chỉnh sửa thành viên” — vai trò được trao và thay đổi qua “Thêm thành viên vào dự án”.",
    ],
  },
  {
    id: "notes",
    title: "Nhật ký công trình",
    purpose:
      "Những thẻ ghi ngắn có ngày tháng, ghi lại chuyện xảy ra ở công trường: quyết định, cuộc gọi, giao hàng, kiểm tra và thanh toán.",
    steps: [
      "Gõ vào ô ghi chú nhanh ở trên cùng; bấm vào đó thì ô nội dung hiện ra.",
      "Nếu muốn, gán cho ghi chú một danh mục: “Kiểm tra”, “Giao hàng”, “Thanh toán”, “Quyết định”, “Cuộc gọi” hoặc “Chung”.",
      "Lưu ghi chú. Các thẻ tự gom vào “Hôm nay”, “Hôm qua”, “Đầu tuần này” và “Trước đó”.",
      "Bấm một thẻ để sửa ngay tại chỗ, hoặc tích vào để đánh dấu hoàn thành và bỏ tích để mở lại.",
      "Tìm trong nhật ký, hoặc thu hẹp bằng bộ lọc danh mục.",
    ],
    whoCanDoIt:
      "Ai ở trong dự án cũng đọc được nhật ký. Viết, sửa, đánh dấu hoàn thành và xóa đều cần quyền chỉnh sửa dự án.",
    gotchas: [
      "Xóa ghi chú không hỏi lại: nó biến mất ngay, chỉ còn một thông báo “Hoàn tác” hiện trong chốc lát. Thông báo đó tắt là ghi chú mất hẳn.",
    ],
  },
  {
    id: "documents",
    title: "Tài liệu dự án",
    purpose:
      "Kho file của công trình — bản vẽ, hợp đồng, giấy phép — kèm gắn nhãn, xem trước, đổi tên và xóa.",
    steps: [
      "Kéo file thả vào vùng tải lên hoặc bấm để chọn. Chấp nhận PDF, PNG, JPG, WebP, DOCX, XLSX, DWG và TXT, tối đa 150 MB mỗi file.",
      "Mỗi file tải lên chạy riêng; từng dòng đi từ “Đang chờ” sang “Đang tải lên” rồi “Đã tải lên”.",
      "Thu hẹp kho file bằng bộ lọc loại file, ô chọn người tải lên và các nhãn, rồi đặt lại tất cả chỉ bằng một cú bấm.",
      "Với từng file: xem trước PDF hoặc ảnh, tải xuống, đổi tên — phần mở rộng không đổi được — hoặc xóa.",
      "Thêm nhãn tự do ngay trong cột nhãn.",
    ],
    whoCanDoIt:
      "Chỉ quản trị viên và quản lý dự án. Đây là mục duy nhất của dự án mà thành viên thường không đọc được, và thanh bên ẩn hẳn mục này với họ.",
    gotchas: [
      "Đổi tên hoặc xóa vẫn có thể bị từ chối ngay cả với quản lý: chỉ người đã tải file lên, hoặc quản trị viên dự án, mới thay đổi được file đó.",
    ],
  },
  {
    id: "photos",
    title: "Ảnh và video công trường",
    purpose:
      "Hồ sơ hình ảnh của công trình — ảnh và video tiến độ, mỗi mục có chú thích và ngày chụp.",
    steps: [
      "Mở “Phương tiện” từ thẻ dự án.",
      "Bấm “Thêm phương tiện” để tải lên. Ảnh nhận JPEG, PNG hoặc WebP tối đa 25 MB; video nhận MP4, WebM hoặc MOV tối đa 50 MB.",
      "Mở một mục để viết chú thích mô tả nội dung, và đặt ngày chụp.",
      "Cũng ở đó thì xóa được một mục; hệ thống hỏi lại trước, và xóa là vĩnh viễn.",
    ],
    whoCanDoIt:
      "Ai ở trong dự án cũng xem được. Tải lên, viết chú thích và xóa cần quyền chỉnh sửa dự án.",
  },
  {
    id: "analyses",
    title: "Báo cáo phân tích",
    purpose:
      "Một kệ chứa các báo cáo và hướng dẫn HTML đã lưu cho công trình, mỗi bản mở ra trong trình đọc không có gì gây xao nhãng.",
    steps: [
      "Bấm “Tải lên phân tích” và chọn báo cáo HTML — tệp phải độc lập, không kèm tệp ngoài, và tối đa 2 MB.",
      "Đặt tiêu đề, và nếu muốn thì thêm tóm tắt, URL nguồn và nhãn.",
      "Thu hẹp kệ báo cáo bằng ô tìm kiếm và các nhãn.",
      "Bấm một thẻ để mở trình đọc; bảng bên cạnh cho biết ai tải lên, khi nào, và nguồn của báo cáo.",
      "Dùng “Chỉnh sửa” hoặc “Xóa” ngay trên trang của báo cáo đó.",
    ],
    whoCanDoIt:
      "Ai ở trong dự án cũng đọc được. Tải lên, chỉnh sửa và xóa cần quyền chỉnh sửa dự án.",
    gotchas: [
      "Trên thẻ ngoài lưới không có nút chỉnh sửa hay xóa — phải mở báo cáo ra trước.",
    ],
  },
  {
    id: "bibliotheque",
    title: "Thư viện sản phẩm",
    purpose:
      "Danh mục dùng chung cho cả công ty về những sản phẩm bạn mua từ nhà cung cấp, kèm lịch sử mua hàng và bảng so sánh giá cạnh nhau.",
    steps: [
      "Tìm theo tên sản phẩm, hoặc lọc theo nhà cung cấp và danh mục.",
      "Bấm “Thêm sản phẩm”, chọn nhà cung cấp có sẵn hoặc tạo mới, rồi điền tên — bắt buộc — và nếu muốn thì thêm mã tham chiếu, danh mục, kích cỡ, mô tả, liên kết và hình ảnh.",
      "Bấm một thẻ sản phẩm để xem chi tiết và lịch sử mua hàng: ngày, mã tham chiếu, phiếu, đơn hàng, số lượng và đơn giá.",
      "Từ hộp thoại đó, sửa hoặc xóa sản phẩm. Khi xóa, bạn phải gõ lại tên sản phẩm.",
      "Bấm “So sánh”, tích tối đa bốn sản phẩm, rồi đặt chúng cạnh nhau.",
    ],
    whoCanDoIt:
      "Ai liên kết với một công ty cũng đọc được. Các nút thêm, sửa và xóa luôn hiện, nhưng máy chủ sẽ từ chối thay đổi nếu bạn không có quyền quản lý thư viện, và nó báo cho bạn biết.",
    gotchas: [
      "Thư viện thuộc về một công ty — công ty chính của bạn — và không có bộ chọn công ty.",
    ],
  },
  {
    id: "billing-devis",
    title: "Báo giá",
    purpose:
      "Những báo giá công ty bạn phát hành cho khách của mình: soạn, gửi, theo dõi, và chuyển một báo giá đã được chấp nhận thành hóa đơn.",
    steps: [
      "Mở “Báo giá & Hóa đơn” → “Báo giá” rồi bấm “Báo giá mới”.",
      "Bắt đầu từ trống, từ một tài liệu có sẵn, hoặc từ một mẫu.",
      "Nếu bạn quản trị nhiều công ty, chọn công ty đứng ra phát hành báo giá.",
      "Điền khách hàng — tên là bắt buộc — và phần chi tiết: ngày phát hành, ngày hết hiệu lực, và công trình liên quan nếu có.",
      "Thêm các dòng dịch vụ, kiểm tra phần tổng, rồi tạo báo giá.",
      "Chuyển trạng thái dần từ “Nháp” sang “Đã gửi” rồi “Đã chấp nhận”, sau đó dùng “Chuyển thành hóa đơn”.",
    ],
    whoCanDoIt:
      "Chỉ quản trị viên công ty. Những người khác không thấy nhóm “Báo giá & Hóa đơn”.",
  },
  {
    id: "billing-factures",
    title: "Hóa đơn cho khách hàng",
    purpose:
      "Những hóa đơn công ty bạn phát hành cho khách, theo dõi cho tới khi được thanh toán, kèm xuất PDF và bảng tính.",
    steps: [
      "Mở “Báo giá & Hóa đơn” → “Hóa đơn” rồi bấm “Hóa đơn mới”.",
      "Bắt đầu từ trống, từ một tài liệu có sẵn hoặc từ một mẫu, và chọn công ty phát hành nếu bạn quản trị nhiều công ty.",
      "Điền khách hàng, rồi ngày phát hành, hạn thanh toán, điều khoản thanh toán, và công trình nếu có.",
      "Thêm các dòng dịch vụ, xem phần tổng tự cập nhật, rồi tạo hóa đơn.",
      "Chuyển trạng thái dần: “Nháp”, “Đã gửi”, rồi “Đã thanh toán”, “Quá hạn” hoặc “Đã hủy”. Hóa đơn quá hạn vẫn đánh dấu đã thanh toán được.",
      "Tải hóa đơn về dạng PDF hoặc XLSX, hoặc xóa — trước khi xóa hệ thống hỏi lại.",
    ],
    whoCanDoIt: "Chỉ quản trị viên công ty.",
    gotchas: [
      "Khi hóa đơn đã đánh dấu “Đã thanh toán”, trạng thái duy nhất còn lại là hủy nó dưới dạng hoàn tiền.",
    ],
  },
  {
    id: "billing-templates",
    title: "Mẫu báo giá và hóa đơn",
    purpose:
      "Bộ khung dùng lại cho những tài liệu bạn phát hành thường xuyên: các dòng dịch vụ, thuế suất VAT mặc định, ghi chú và điều khoản chung của bạn.",
    steps: [
      "Mở “Báo giá & Hóa đơn” → “Mẫu tài liệu”. Nếu bạn quản trị nhiều công ty, chọn xem mẫu của công ty nào — mỗi mẫu thuộc về một công ty.",
      "Bấm “Mẫu mới” và chọn loại, báo giá hay hóa đơn. Tạo xong thì không đổi loại được nữa.",
      "Đặt tên mẫu và chọn thuế suất VAT mặc định, lấy một mức thông dụng hoặc tự nhập mức riêng.",
      "Thêm các dòng dịch vụ, và nếu muốn thì thêm ghi chú cùng điều khoản chung, rồi lưu.",
      "Từ danh sách, bấm “Dùng mẫu này” để mở một tài liệu mới đã điền sẵn.",
    ],
    whoCanDoIt: "Chỉ quản trị viên công ty.",
    gotchas: ["Hai mẫu cùng loại không được trùng tên."],
  },
  {
    id: "billing-refundable",
    title: "Chi phí chờ hoàn tiền",
    purpose:
      "Cái nhìn toàn công ty về những chi phí vật tư & dịch vụ đã đánh dấu chờ hoàn tiền ở mọi dự án, và mỗi khoản đã được hoàn tới đâu.",
    steps: [
      "Mở “Báo giá & Hóa đơn” → “Hoàn tiền”.",
      "Bấm “Thêm chi phí hoàn tiền” rồi tìm trong những chi phí chưa được đánh dấu, theo dự án, số hóa đơn hoặc người nhận.",
      "Tích những khoản cần theo dõi rồi thêm vào.",
      "Đặt trạng thái cho từng dòng: “Có thể hoàn tiền”, “Đang chờ hoàn tiền”, được công ty hoàn, được ngân hàng hoàn, hay được cả hai — hoặc gỡ đánh dấu hẳn.",
      "Mở tệp đính kèm của một chi phí từ cột hóa đơn để kiểm tra giấy tờ.",
      "Đọc các số tổng: tổng đã hoàn, công ty đã hoàn, ngân hàng đã hoàn, và số vẫn còn chờ hoàn.",
    ],
    whoCanDoIt: "Chỉ quản trị viên công ty.",
    gotchas: [
      "Bảng hiển thị tối đa 200 dòng; quá số đó nó cho bạn biết đang hiển thị bao nhiêu.",
    ],
  },
  {
    id: "company",
    title: "Công ty, thành viên và quyền",
    purpose:
      "Những công ty bạn thuộc về, và — với công ty bạn quản trị — mã tham gia, vai trò của thành viên, các quyền được cấp riêng và danh bạ nhân sự.",
    steps: [
      "Mở “Cài đặt” → “Công ty”.",
      "Bấm “Thêm công ty” rồi dán mã mời hoặc nhập mã công ty để liên kết mình với một công ty khác.",
      "Nếu bạn thuộc nhiều công ty, chuyển qua lại bằng bộ chọn công ty; một nhãn nhỏ cho biết vai trò của bạn ở từng nơi.",
      "Dùng “Đặt làm chính” để chọn công ty mặc định, hoặc “Hủy liên kết” để rời khỏi một công ty.",
      "Là quản trị viên, hãy quản lý mã công ty: tạo mã, tạo mã mới, thu hồi, hoặc sao chép để chia sẻ. Mọi người nhập mã đó trong app Folio trên điện thoại để tham gia với vai trò thành viên.",
      "Trong bảng thành viên, đổi vai trò của một người, hoặc mở “Quyền tuỳ chỉnh” để cấp hay từ chối một quyền cụ thể, cho toàn công ty hoặc chỉ trên một dự án.",
      "Dùng “Thêm bằng số điện thoại” để thêm người theo số, hoặc “Nhập từ công ty khác” để mang người từ một công ty khác bạn quản trị sang.",
      "Danh bạ liệt kê mọi người liên kết với công ty, kèm số điện thoại, đã đăng nhập lần nào chưa, và những dự án họ được giao.",
      "Ở “Phương thức thanh toán”, thêm, đổi tên hoặc xóa những cách hóa đơn của công ty đó được thanh toán. Phương thức có sẵn đổi tên được nhưng không xóa được.",
    ],
    whoCanDoIt:
      "Ai cũng xem được các công ty mình thuộc về và liên kết thêm công ty. Mã công ty, bảng thành viên, danh bạ và phương thức thanh toán chỉ dành cho quản trị viên của công ty đang chọn.",
    gotchas: [
      "Có hai cách thêm người và chúng không thay thế cho nhau: mã mời dùng một lần, có hiệu lực bảy ngày, và mã công ty dùng lại được mà mọi người nhập trong app điện thoại.",
    ],
  },
  {
    id: "settings",
    title: "Hồ sơ và tùy chọn của bạn",
    purpose:
      "Thông tin của chính bạn, cách đánh số hóa đơn của dự án đang chọn, và những thông báo nào được gửi tới điện thoại của bạn.",
    steps: [
      "Mở “Cài đặt”; danh sách bên trái dùng để chọn mục.",
      "Ở “Hồ sơ”, sửa tên hiển thị và số điện thoại rồi lưu. Email chỉ để xem — chỉ quản trị viên mới đổi được.",
      "Ở “Dự án”, đặt tiền tố số hóa đơn cho dự án đang chọn, tối đa tám chữ cái hoặc chữ số, và xem dòng ví dụ trước khi lưu.",
      "Ở “Công ty”, quản lý những công ty bạn thuộc về: thẻ thông tin của từng công ty, công ty nào là chính, hủy liên kết, và liên kết thêm một công ty bằng mã. Nếu bạn quản trị công ty đang chọn, chỗ này có thêm mã tham gia, bảng thành viên và phương thức thanh toán của công ty đó.",
      "Ở “Thông báo”, dùng công tắc chính và các công tắc theo nhóm: “Trò chuyện nhóm”, “Chấm công”, “Công việc”, “Nhóm & quyền truy cập” và “Tiền”.",
      "Ở “Khóa API”, đặt tên rồi tạo một khóa để gọi API của Folio từ script của bạn: hãy sao chép ngay, vì khóa sẽ không bao giờ hiện lại. Thu hồi một khóa sẽ lập tức và vĩnh viễn dừng mọi tự động hóa đang dùng khóa đó.",
      "Ở “Người dùng & vai trò”, mục chỉ bộ phận hỗ trợ Folio mới mở được, hãy gắn một tài khoản có sẵn vào các dự án: tìm người đó, tích chọn dự án, rồi gửi. Vai trò không đặt ở đây — chúng đến từ vai trò trong công ty và các quyền cấp riêng theo từng dự án, ở “Công ty”.",
      "Phiên bản Folio bạn đang chạy được ghi ở cuối trang, bên dưới mục đang mở.",
    ],
    whoCanDoIt:
      "Ai cũng vào được hồ sơ của mình, tiền tố của dự án, lựa chọn thông báo và khóa API của riêng mình. “Công ty” cho ai cũng thấy liên kết công ty của chính mình, còn công cụ quản trị — mã tham gia, bảng thành viên, phương thức thanh toán — chỉ dành cho quản trị viên của công ty đang chọn. “Người dùng & vai trò” chỉ dành cho bộ phận hỗ trợ Folio.",
    gotchas: [
      "Cài đặt không có mục báo giá hay hóa đơn nào. Báo giá, hóa đơn và mẫu đều nằm ở nhóm “Báo giá & Hóa đơn” trên thanh bên.",
      "Các công tắc thông báo điều khiển thông báo đẩy gửi tới app Folio trên điện thoại, không phải cái chuông trong cửa sổ này.",
    ],
  },
  {
    id: "notifications",
    title: "Chuông thông báo",
    purpose:
      "Một dòng tin ngắn và luôn cập nhật về những gì cần bạn để ý: nhắc nhở từ ghi chú đã tới hạn, ngày công do công nhân tự chấm đang chờ duyệt, và những người vừa tham gia công ty.",
    steps: [
      "Bấm chuông trên thanh trên cùng. Con số trên chuông đếm nhắc nhở và mục chấm công, quá chín thì hiện “9+”.",
      "Trong “Chấm công chờ duyệt”, bấm “Duyệt” hoặc “Từ chối” cho từng ngày công nhân đã khai.",
      "Bấm một nhắc nhở để nhảy tới ghi chú của dự án đó, hoặc bỏ qua bằng dấu ✕.",
      "“Thành viên mới” liệt kê những người vừa tham gia công ty, kèm liên kết tới trang cài đặt để bạn xếp họ vào dự án.",
    ],
    whoCanDoIt:
      "Ai cũng thấy chuông. Nội dung bên trong thì tùy từng người: các dòng chấm công chỉ đến với những ai có quyền duyệt.",
    gotchas: [
      "Sự kiện thành viên mới không được tính vào con số trên chuông, nên bảng thông báo có thể có nội dung trong khi chuông trông như không có gì.",
      "Dòng tin làm mới khoảng mỗi phút một lần chứ không phải ngay lập tức.",
    ],
  },
  {
    id: "chat",
    title: "Trò chuyện nhóm",
    purpose:
      "Nơi trao đổi với công ty và với đội của từng công trình, mỗi công ty và mỗi công trình một kênh.",
    steps: [
      "Mở trò chuyện từ nút ở góc cửa sổ.",
      "Chọn một kênh trong danh sách; kênh có tin chưa đọc được đánh dấu.",
      "Viết tin nhắn rồi gửi.",
      "Đính kèm ảnh vào tin nhắn khi một tấm hình nói nhanh hơn lời.",
      "Ảnh đại diện dưới tin nhắn mới nhất cho biết ai đã đọc tới đó.",
    ],
    whoCanDoIt:
      "Tất cả mọi người. Các kênh bạn thấy đi theo quyền truy cập công ty và những công trình bạn tham gia. Trò chuyện có thể bị tắt trên một máy chủ, khi đó ứng dụng sẽ báo cho bạn.",
  },
];

/** The panel's own labels in this language. */
export const helpChromeVi: HelpChrome = {
  title: "Folio hoạt động thế nào",
  subtitle: "Mọi quy trình, từng bước một.",
  back: "Tất cả chủ đề",
  steps: "Các bước",
  whoCanDoIt: "Ai có thể làm",
  gotchas: "Cần lưu ý",
  close: "Đóng hướng dẫn",
};
