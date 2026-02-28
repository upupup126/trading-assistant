---
name: stock-market-ai-analyst
description: Provides specialized AI analysis capabilities for stock market data, including market sentiment analysis, individual stock evaluation, risk assessment, and trading strategy recommendations. Use when implementing AI-driven financial analysis features in trading applications.
---

# Stock Market AI Analyst

## Overview

This skill enables AI-powered stock market analysis by providing specialized prompts, analysis frameworks, and integration patterns for financial AI services. It transforms general AI capabilities into domain-specific financial expertise for market analysis, stock evaluation, risk assessment, and trading recommendations.

## Core Capabilities

### 1. Market Sentiment Analysis
Analyze overall market conditions, identify trending sectors, and assess market sentiment from multiple data sources.

**Use cases:**
- Daily market overview generation
- Sector rotation analysis
- Market mood assessment
- Hot topic identification

**Implementation pattern:**
```python
# Use the market_analysis_prompt.md template
prompt = load_prompt_template("market_analysis", {
    "date": today,
    "market_data": current_market_snapshot,
    "news_headlines": recent_news
})
analysis = ai_client.analyze(prompt)
```

### 2. Individual Stock Analysis
Comprehensive evaluation of individual stocks combining technical indicators, fundamental metrics, and AI-driven insights.

**Analysis dimensions:**
- Technical analysis (price patterns, indicators)
- Fundamental analysis (financial metrics, ratios)
- Sentiment analysis (news, social media)
- Risk-reward assessment
- Entry/exit point recommendations

**Key outputs:**
- Buy/Sell/Hold recommendations
- Target price ranges
- Risk assessment scores
- Confidence levels

### 3. Risk Assessment
Multi-dimensional risk evaluation for individual positions and portfolios.

**Risk categories:**
- Market risk (systematic risk factors)
- Liquidity risk (trading volume, bid-ask spreads)
- Concentration risk (portfolio diversification)
- Volatility risk (price stability metrics)

### 4. Trading Strategy Recommendations
AI-generated trading strategies based on market conditions and user preferences.

**Strategy types:**
- Momentum strategies
- Mean reversion strategies
- Breakout strategies
- Risk management strategies

## Implementation Workflow

### Step 1: Initialize AI Analysis Service
Set up the AI client with financial domain expertise using the provided prompt templates and configuration.

```python
from services.ai_analyst import StockMarketAIAnalyst

analyst = StockMarketAIAnalyst(
    model="gpt-4",
    temperature=0.3,  # Lower temperature for more consistent analysis
    max_tokens=2000
)
```

### Step 2: Market Analysis
Perform market-wide analysis to understand current conditions.

```python
market_analysis = await analyst.analyze_market_sentiment({
    "market_indices": ["SPY", "QQQ", "IWM"],
    "timeframe": "1d",
    "include_sectors": True,
    "include_news": True
})
```

### Step 3: Stock-Specific Analysis
Analyze individual stocks with comprehensive evaluation.

```python
stock_analysis = await analyst.analyze_stock({
    "symbol": "AAPL",
    "analysis_type": "comprehensive",
    "include_technical": True,
    "include_fundamental": True,
    "user_context": user_preferences
})
```

### Step 4: Risk Assessment
Evaluate risk factors for positions or portfolios.

```python
risk_assessment = await analyst.assess_risk({
    "portfolio": user_positions,
    "market_conditions": current_market,
    "risk_tolerance": user_risk_profile
})
```

## Prompt Engineering Guidelines

### Financial Domain Expertise
Structure prompts to leverage AI's understanding of financial concepts while providing specific context and constraints.

**Key principles:**
- Include relevant market context
- Specify analysis timeframes
- Define risk parameters
- Request confidence scores
- Ask for reasoning transparency

### Analysis Consistency
Maintain consistent analysis quality across different market conditions and time periods.

**Techniques:**
- Use structured output formats
- Include confidence scoring
- Request multiple scenarios
- Validate against historical patterns

### Risk Management Integration
Ensure all AI recommendations include appropriate risk warnings and disclaimers.

**Required elements:**
- Risk level classification
- Potential downside scenarios
- Market condition dependencies
- Disclaimer statements

## Quality Assurance

### Validation Checks
Implement validation to ensure AI analysis quality and consistency.

**Validation criteria:**
- Logical consistency in recommendations
- Appropriate confidence levels
- Risk-reward alignment
- Market condition awareness

### Fallback Strategies
Handle cases where AI analysis may be unreliable or unavailable.

**Fallback approaches:**
- Use cached analysis for similar conditions
- Provide conservative default recommendations
- Escalate to human review for critical decisions

## Integration Patterns

### Real-time Analysis
Integrate with market data feeds for real-time analysis capabilities.

### Batch Processing
Process multiple analysis requests efficiently for portfolio-wide evaluations.

### Caching Strategy
Cache analysis results appropriately while ensuring data freshness for time-sensitive decisions.

## Resources

### references/
Contains detailed prompt templates, analysis frameworks, and financial domain knowledge that inform the AI analysis process.

### scripts/
Includes utility scripts for data processing, analysis validation, and integration with external financial APIs.

### assets/
Provides analysis report templates and visualization assets for presenting AI analysis results to users.
