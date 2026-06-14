import prisma from '../../utils/db.js';
import PDFDocument from 'pdfkit';

// 1. 📊 THE PREVIEW ROUTE (JSON)
export const getLedgerData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query; 

    let purchaseFilter = { userId: userId };
    let saleFilter = { inventory: { userId: userId } };

    if (startDate && endDate) {
      const bounds = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
      purchaseFilter.createdAt = bounds;
      saleFilter.soldAt = bounds;
    }

    const purchases = await prisma.purchase.findMany({ where: purchaseFilter });
    
    const sales = await prisma.sale.findMany({
      where: saleFilter,
      // 🚨 FIX 1: Explicitly select the new Khata database columns
      select: { 
        id: true,
        soldAt: true, 
        quantity: true, 
        sellPrice: true, 
        paymentStatus: true,
        amountPaid: true,
        amountDue: true,
        buyerName: true,
        inventory: { select: { name: true, unit: true } } 
      }
    });

    let ledgerItems = [];
    
    purchases.forEach(p => ledgerItems.push({
      id: `p_${p.id}`, 
      date: p.createdAt, 
      type: 'PURCHASE', 
      name: p.name, 
      qty: p.quantity, 
      unit: p.unit || 'Qtl', 
      rate: p.buyPrice, 
      total: p.total,
      // 🚨 FIX 2: Attach Khata fields to Purchase items
      paymentStatus: p.paymentStatus || 'PAID',
      amountPaid: p.amountPaid || p.total,
      amountDue: p.amountDue || 0
    }));

    sales.forEach(s => ledgerItems.push({
      // Replaced getTime() with the actual DB ID since we selected it
      id: `s_${s.id}`, 
      date: s.soldAt, 
      type: 'SALE', 
      name: s.inventory?.name || 'Commodity', 
      qty: s.quantity, 
      unit: s.inventory?.unit || 'Qtl', 
      rate: s.sellPrice, 
      total: s.quantity * s.sellPrice,
      // 🚨 FIX 3: Attach Khata fields to Sale items
      paymentStatus: s.paymentStatus || 'PAID',
      amountPaid: s.amountPaid || (s.quantity * s.sellPrice),
      amountDue: s.amountDue || 0,
      partyName: s.buyerName // Optional context for the frontend
    }));

    ledgerItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalInflow = ledgerItems.filter(i => i.type === 'SALE').reduce((sum, i) => sum + i.total, 0);
    const totalOutflow = ledgerItems.filter(i => i.type === 'PURCHASE').reduce((sum, i) => sum + i.total, 0);

    res.status(200).json({ status: "success", data: ledgerItems, totalInflow, totalOutflow, balance: totalInflow - totalOutflow });
  } catch (error) {
    console.error("Ledger Data Error:", error);
    res.status(500).json({ error: "Failed to fetch ledger data." });
  }
};

// 2. 🖨️ THE PDF PRINT ROUTE
export const exportFullLedgerPDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    let purchaseFilter = { userId: userId };
    let saleFilter = { inventory: { userId: userId } };

    if (startDate && endDate) {
      const bounds = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
      purchaseFilter.createdAt = bounds;
      saleFilter.soldAt = bounds;
    }

    const purchases = await prisma.purchase.findMany({ where: purchaseFilter });
    
    // 🚨 FIX 1: Explicitly select the new Khata database columns
    const sales = await prisma.sale.findMany({ 
      where: saleFilter, 
      select: { 
        soldAt: true, 
        quantity: true, 
        sellPrice: true, 
        paymentStatus: true, // <--- NEW
        amountDue: true,     // <--- NEW
        inventory: { select: { name: true, unit: true } } 
      } 
    });

    let ledgerItems = [];
    
    // 🚨 FIX 2: Map the paymentStatus to the array
    purchases.forEach(p => ledgerItems.push({ 
      date: p.createdAt, type: 'PURCHASE', name: p.name, 
      qty: p.quantity, unit: p.unit || 'Qtl', rate: p.buyPrice, 
      total: p.total, 
      status: p.paymentStatus || 'PAID' // Default to PAID if older record
    }));
    
    sales.forEach(s => ledgerItems.push({ 
      date: s.soldAt, type: 'SALE', name: s.inventory?.name || 'Commodity', 
      qty: s.quantity, unit: s.inventory?.unit || 'Qtl', rate: s.sellPrice, 
      total: s.quantity * s.sellPrice, 
      status: s.paymentStatus || 'PAID' 
    }));
    
    ledgerItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalInflow = ledgerItems.filter(i => i.type === 'SALE').reduce((sum, i) => sum + i.total, 0);
    const totalOutflow = ledgerItems.filter(i => i.type === 'PURCHASE').reduce((sum, i) => sum + i.total, 0);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Ledger_${startDate || 'All'}_to_${endDate || 'All'}.pdf`);
    doc.pipe(res);

    const PRIMARY_COLOR = '#1E3A8A';
    doc.rect(40, 40, 515, 65).fill(PRIMARY_COLOR);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Business Ledger Report', 55, 52);
    
    const dateLabel = (startDate && endDate) ? `Period: ${startDate} to ${endDate}` : 'Period: All Time History';
    doc.fillColor('#DBEAFE').font('Helvetica').fontSize(10).text(dateLabel, 55, 76);
    
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { city: true } });
    doc.fillColor('#FFFFFF').fontSize(9).text(`Location: ${user?.city || 'India'}`, 400, 52, { align: 'right', width: 140 });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 400, 65, { align: 'right', width: 140 });

    let rowY = 140;
    doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(9);
    
    // 🚨 FIX 3: Adjusted X-coordinates to make room for the new "Status" column
    doc.text('Date', 45, rowY);
    doc.text('Type', 95, rowY);
    doc.text('Status', 140, rowY); // <--- NEW COLUMN HEADER
    doc.text('Item', 185, rowY);
    doc.text('Qty', 350, rowY, { align: 'right', width: 40 });
    doc.text('Rate', 400, rowY, { align: 'right', width: 60 });
    doc.text('Net Total', 470, rowY, { align: 'right', width: 75 });
    doc.rect(40, rowY + 12, 515, 2).fill(PRIMARY_COLOR);

    rowY += 22;
    doc.font('Helvetica').fontSize(9);
    
    if (ledgerItems.length === 0) {
        doc.fillColor('#1F2937').text("No transactions found for this period.", 45, rowY);
    } else {
        ledgerItems.forEach((item, index) => {
          if (rowY > 750) { doc.addPage(); rowY = 50; }
          if (index % 2 === 0) doc.rect(40, rowY - 4, 515, 18).fill('#F8FAFC');
          
          const isSale = item.type === 'SALE';
          
          // Print Date
          doc.fillColor('#1F2937').text(new Date(item.date).toLocaleDateString('en-IN'), 45, rowY);
          
          // Print Type
          doc.fillColor(isSale ? '#059669' : '#DC2626').text(item.type, 95, rowY); 
          
          // 🚨 FIX 4: Print Status with dynamic colors
          let statusColor = item.status === 'PAID' ? '#059669' : (item.status === 'UNPAID' ? '#DC2626' : '#D97706');
          doc.fillColor(statusColor).text(item.status, 140, rowY);
          
          // Print the rest of the row
          doc.fillColor('#1F2937');
          doc.text(item.name.substring(0, 26), 185, rowY); // Shortened substring slightly to fit
          doc.text(`${item.qty}`, 350, rowY, { align: 'right', width: 40 });
          doc.text(`₹${item.rate}`, 400, rowY, { align: 'right', width: 60 });
          doc.text(`₹${item.total.toLocaleString('en-IN')}`, 470, rowY, { align: 'right', width: 75 });
          
          rowY += 18;
        });
    }

    // Print Footer Totals
    doc.rect(330, rowY + 20, 225, 70).fill('#F3F4F6');
    doc.fillColor('#374151').font('Helvetica').fontSize(10);
    doc.text('Total Outflow:', 340, rowY + 30);
    doc.text(`₹${totalOutflow.toLocaleString('en-IN')}`, 450, rowY + 30, { align: 'right', width: 95 });
    doc.text('Total Inflow:', 340, rowY + 48);
    doc.text(`₹${totalInflow.toLocaleString('en-IN')}`, 450, rowY + 48, { align: 'right', width: 95 });
    doc.font('Helvetica-Bold').fillColor(PRIMARY_COLOR);
    doc.text('Net Balance:', 340, rowY + 68);
    doc.text(`₹${(totalInflow - totalOutflow).toLocaleString('en-IN')}`, 450, rowY + 68, { align: 'right', width: 95 });

    doc.end();
  } catch (error) {
    console.error("Ledger PDF Error:", error);
    res.status(500).json({ error: "Failed to compile master ledger document." });
  }
};